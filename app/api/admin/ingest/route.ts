import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth-helpers'
import { generateEmbedding } from '@/lib/openai'
import { upsertVector } from '@/lib/pinecone'
import { IngestRequestSchema, PineconeMetadata } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Verify admin role
    const user = await requireAdmin(supabase)

    // Parse and validate request body
    const body = await request.json()
    const validatedData = IngestRequestSchema.parse(body)

    // Use service role client for database operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Insert asset into database
    const { data: asset, error: insertError } = await supabaseAdmin
      .from('assets')
      .insert({
        storage_path: validatedData.storage_path,
        preview_path: validatedData.preview_path,
        mime_type: validatedData.mime_type,
        llm_description: validatedData.llm_description,
        llm_metadata: validatedData.llm_metadata,
        tags: validatedData.tags,
        usage_rights: validatedData.usage_rights,
        status: validatedData.status,
        image_purchase_date: validatedData.image_purchase_date,
        image_capture_date: validatedData.image_capture_date,
        license_type_usage: validatedData.license_type_usage,
        license_type_subscription: validatedData.license_type_subscription,
        dam_id: validatedData.dam_id || null,
        url: validatedData.url || null,
        file_name: validatedData.file_name || null,
        acquired_at: validatedData.acquired_at || null,
        partner: validatedData.partner || null,
        client: validatedData.client || null,
        brand: validatedData.brand || null,
        collection: validatedData.collection || null,
        region_representation: validatedData.region_representation || null,
        location: validatedData.location || null,
        campaign: validatedData.campaign || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !asset) {
      console.error('Error inserting asset:', insertError)
      return NextResponse.json(
        { error: 'Failed to save asset to database' },
        { status: 500 }
      )
    }

    // Generate embedding
    const embedding = await generateEmbedding(validatedData.llm_description)

    // Prepare metadata for Pinecone
    const pineconeMetadata: PineconeMetadata = {
      assetId: asset.id,
      dam_id: asset.dam_id || undefined,
      file_name: asset.file_name || undefined,
      url: asset.url || undefined,
      preview_path: asset.preview_path,
      llm_description: asset.llm_description,
      tags: asset.tags || undefined,
      usage_rights: asset.usage_rights,
      status: asset.status,
      license_type_usage: asset.license_type_usage,
      license_type_subscription: asset.license_type_subscription,
      brand: asset.brand || undefined,
      collection: asset.collection || undefined,
      region_representation: asset.region_representation || undefined,
      partner: asset.partner || undefined,
      client: asset.client || undefined,
      location: asset.location || undefined,
      campaign: asset.campaign || undefined,
      image_purchase_date: new Date(asset.image_purchase_date).getTime(),
      image_capture_date: new Date(asset.image_capture_date).getTime(),
    }

    // Upsert to Pinecone
    await upsertVector(asset.id, embedding, pineconeMetadata)

    return NextResponse.json({
      success: true,
      asset_id: asset.id,
      message: 'Asset ingested successfully and ready for search in Brandon',
    })
  } catch (error: any) {
    console.error('Error in ingest:', error)

    if (error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
