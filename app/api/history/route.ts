import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create Supabase client with user's token
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

    // Fetch chat messages for the user
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching chat history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (error: any) {
    console.error('Error in history GET:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Not authenticated' ? 401 : 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create Supabase client with user's token
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

    // Delete all chat messages for the user
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting chat history:', error)
      return NextResponse.json(
        { error: 'Failed to delete chat history' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Chat history cleared' })
  } catch (error: any) {
    console.error('Error in history DELETE:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Not authenticated' ? 401 : 500 }
    )
  }
}
