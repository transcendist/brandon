import sharp from 'sharp'

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export async function generatePreview(
  imageBuffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<Buffer> {
  const {
    maxWidth = 800,
    maxHeight = undefined,
    quality = 80,
    format = 'jpeg',
  } = options

  try {
    let pipeline = sharp(imageBuffer).resize(maxWidth, maxHeight, {
      withoutEnlargement: true,
      fit: 'inside',
    })

    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality })
        break
      case 'png':
        pipeline = pipeline.png({ quality })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
    }

    return await pipeline.toBuffer()
  } catch (error) {
    console.error('Error generating preview:', error)
    throw new Error('Failed to generate preview image')
  }
}

export async function getImageMetadata(imageBuffer: Buffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    }
  } catch (error) {
    console.error('Error getting image metadata:', error)
    throw new Error('Failed to get image metadata')
  }
}

export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are supported.')
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 10MB.')
  }

  return true
}
