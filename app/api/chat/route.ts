import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth-helpers'
import { generateEmbedding } from '@/lib/openai'
import { queryVectors } from '@/lib/pinecone'
import { generateChatResponse } from '@/lib/gemini'
import { ChatRequestSchema, BrandonAsset } from '@/lib/types'
import { checkRateLimit, isRateLimited, getRateLimitHeaders } from '@/lib/rate-limit'

// Helper to create SSE response
function createSSEResponse() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl
    },
  })

  function send(event: { type: string; data?: any }) {
    const message = `data: ${JSON.stringify(event)}\n\n`
    controller.enqueue(encoder.encode(message))
  }

  function close() {
    controller.close()
  }

  return { stream, send, close }
}

export async function POST(request: NextRequest) {
  const { stream, send, close } = createSSEResponse()

  // Process the request asynchronously
  processRequest(request, send, close).catch((error) => {
    console.error('Error processing request:', error)
    send({
      type: 'error',
      data: { error: error.message || 'Internal server error' },
    })
    close()
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function processRequest(
  request: NextRequest,
  send: (event: any) => void,
  close: () => void
) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      send({ type: 'error', data: { error: 'Unauthorized' } })
      close()
      return
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Authenticate user
    const user = await requireAuth(supabase)

    // Rate limiting
    const rateLimitInfo = checkRateLimit(user.id)
    if (isRateLimited(rateLimitInfo)) {
      send({
        type: 'error',
        data: {
          error: 'Rate limit exceeded',
          reset: new Date(rateLimitInfo.reset).toISOString(),
        },
      })
      close()
      return
    }

    // Parse and validate request
    const body = await request.json()
    const validatedData = ChatRequestSchema.parse(body)

    // Extract latest user message
    const userMessages = validatedData.messages.filter((m) => m.role === 'user')
    if (userMessages.length === 0) {
      send({ type: 'error', data: { error: 'No user message found' } })
      close()
      return
    }

    const latestUserMessage = userMessages[userMessages.length - 1]
    const userQuery = latestUserMessage.content

    // Save user message to database
    const { data: savedUserMessage, error: saveUserError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role: 'user',
        content: userQuery,
      })
      .select()
      .single()

    if (saveUserError) {
      console.error('Error saving user message:', saveUserError)
    }

    // Send status: Analyzing query
    send({ type: 'status', data: { status: 'Analyzing your query...' } })

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(userQuery)

    // Get total asset count
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { count: totalAssets } = await supabaseAdmin
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // Send status: Searching
    send({
      type: 'status',
      data: {
        status: `Searching through ${totalAssets?.toLocaleString() || 0} assets...`,
      },
    })

    // Query Pinecone
    const pineconeResults = await queryVectors(
      queryEmbedding,
      30,
      { status: 'approved' } // Filter for approved assets
    )

    // Send status: Found matches
    send({
      type: 'status',
      data: { status: `Found ${pineconeResults.length} potential matches` },
    })

    // Send status: Ranking
    send({
      type: 'status',
      data: { status: 'Ranking by relevance and recency...' },
    })

    // Re-rank by recency
    const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const ALPHA = 0.8 // Semantic similarity weight

    const candidates = pineconeResults.map((result: any) => {
      const purchaseDateMs = result.metadata.image_purchase_date || now
      const age = now - purchaseDateMs
      const recencyScore = Math.max(0, 1 - age / THREE_YEARS_MS)
      const combinedScore = ALPHA * result.score + (1 - ALPHA) * recencyScore

      return {
        ...result.metadata,
        similarity: result.score,
        recencyScore,
        combinedScore,
      }
    })

    // Sort by combined score
    candidates.sort((a, b) => b.combinedScore - a.combinedScore)

    // Take top 10
    const topCandidates = candidates.slice(0, 10)

    // Send status: Generating response
    send({ type: 'status', data: { status: 'Generating response...' } })

    // Call Gemini to generate response
    const geminiResponse = await generateChatResponse(userQuery, topCandidates)

    // Save assistant message to database
    const { error: saveAssistantError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: geminiResponse.assistant_message,
        assets: geminiResponse.assets,
      })

    if (saveAssistantError) {
      console.error('Error saving assistant message:', saveAssistantError)
    }

    // Send final result
    send({
      type: 'result',
      data: {
        assistant_message: geminiResponse.assistant_message,
        assets: geminiResponse.assets,
      },
    })

    close()
  } catch (error: any) {
    console.error('Error in chat processing:', error)

    send({
      type: 'error',
      data: { error: error.message || 'Internal server error' },
    })
    close()
  }
}
