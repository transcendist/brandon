import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth-helpers'
import { analyzeImage } from '@/lib/gemini'
import { generatePreview } from '@/lib/image-processing'
import { v4 as uuidv4 } from 'uuid'
import { GeneratedAssetDataSchema } from '@/lib/types'

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
    await requireAdmin(supabase)

    // Parse multipart form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const metadataStr = formData.get('metadata') as string | null

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are supported.' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    // Upload full image to Supabase Storage
    const fileExt = imageFile.name.split('.').pop() || 'jpg'
    const fileName = `${uuidv4()}.${fileExt}`

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('assets-full')
      .upload(fileName, imageBuffer, {
        contentType: imageFile.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading full image:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      )
    }

    // Generate preview image
    const previewBuffer = await generatePreview(imageBuffer, {
      maxWidth: 800,
      quality: 80,
      format: 'jpeg',
    })

    const previewFileName = `${uuidv4()}_preview.jpg`

    const { data: previewUploadData, error: previewError } =
      await supabaseAdmin.storage
        .from('assets-preview')
        .upload(previewFileName, previewBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

    if (previewError) {
      console.error('Error uploading preview image:', previewError)
      // Clean up full image
      await supabaseAdmin.storage.from('assets-full').remove([fileName])
      return NextResponse.json(
        { error: 'Failed to upload preview image' },
        { status: 500 }
      )
    }

    // Generate description with Gemini Vision
    const geminiResponse = await analyzeImage(imageBuffer, imageFile.type)

    // Build LLM description
    const llmDescription = `${geminiResponse.summary}. This image features ${geminiResponse.subjects.join(', ')} with a ${geminiResponse.mood.join(', ')} mood. The setting is ${geminiResponse.setting.environment} during ${geminiResponse.setting.time_of_day}. Composition: ${geminiResponse.composition.orientation} orientation, ${geminiResponse.composition.shot_type} shot. Suitable for ${geminiResponse.usage.typical_channels.join(', ')}.`

    // Extract tags
    const tags = [
      ...geminiResponse.subjects,
      ...geminiResponse.mood,
      ...geminiResponse.keywords,
    ]

    // Get preview URL
    const {
      data: { publicUrl: previewUrl },
    } = supabaseAdmin.storage.from('assets-preview').getPublicUrl(previewFileName)

    // Build response
    const response = {
      storage_path: fileName,
      preview_path: previewFileName,
      preview_url: previewUrl,
      llm_description: llmDescription,
      llm_metadata: geminiResponse,
      tags,
      mime_type: imageFile.type,
    }

    // Validate response
    const validated = GeneratedAssetDataSchema.parse(response)

    return NextResponse.json(validated)
  } catch (error: any) {
    console.error('Error in generate-description:', error)

    if (error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
