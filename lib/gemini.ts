import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiVisionResponseSchema, GeminiChatResponseSchema } from './types'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Vision model for image analysis
export const visionModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
})

// Chat model for conversational responses
export const chatModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
})

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<any> {
  const prompt = `Analyze this automotive/technology brand asset image and provide a structured description in JSON format.

Return ONLY valid JSON with this exact structure:
{
  "summary": "A detailed one-sentence description of the image",
  "subjects": ["primary subject", "secondary subject"],
  "mood": ["mood descriptor 1", "mood descriptor 2"],
  "setting": {
    "environment": "indoor|outdoor|urban|rural|studio|factory|showroom|nature",
    "time_of_day": "morning|afternoon|evening|night|golden_hour",
    "weather": "sunny|cloudy|rainy|snowy|foggy|clear"
  },
  "composition": {
    "orientation": "landscape|portrait|square",
    "shot_type": "close-up|medium|wide|extreme_wide|detail",
    "focus": "product-centered|lifestyle|action|environmental"
  },
  "usage": {
    "typical_channels": ["investor_deck", "press_release", "website_hero", "social_media", "annual_report", "sustainability_report"],
    "tone": ["premium", "industrial", "innovative", "corporate", "lifestyle"]
  },
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Be specific and detailed. Focus on automotive and technology contexts.`

  try {
    const result = await visionModel.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBuffer.toString('base64'),
        },
      },
      { text: prompt },
    ])

    const responseText = result.response.text()

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/\n?```/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/\n?```/g, '')
    }

    const parsed = JSON.parse(jsonText)
    return GeminiVisionResponseSchema.parse(parsed)
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error)
    throw new Error('Failed to analyze image')
  }
}

export async function generateChatResponse(
  userQuery: string,
  candidates: any[]
): Promise<any> {
  const systemInstruction = `You are Brandon, an AI assistant that helps users find automotive and technology brand images.

You receive:
  - user_query: the user's request as text
  - candidates: a list of image objects from the asset library, with:
    preview_path, file_name, dam_id, llm_description, tags, brand, collection,
    usage_rights, partner, client, campaign, location, region_representation,
    image_purchase_date, image_capture_date, similarity, recencyScore, combinedScore.

Rules:
- Use ONLY the provided candidates; never invent URLs or IDs.
- Prefer higher combinedScore.
- If the user mentions "latest", "new", "recent", prioritize more recent image_purchase_date.
- If no good matches exist, politely explain and suggest refining the query.
- Consider usage_rights and status when recommending assets.
- Respond as JSON with:
  {
    "assistant_message": "Your conversational response here",
    "assets": [
      {
        "id": "uuid from candidate",
        "dam_id": "string or null",
        "file_name": "string or null",
        "url": "string or null",
        "preview_path": "string",
        "label": "Short descriptive label for this asset",
        "reason": "Why this asset matches the user's request"
      }
    ]
  }

Return ONLY valid JSON. No markdown, no extra text.`

  const prompt = `User Query: ${userQuery}

Candidates:
${JSON.stringify(candidates, null, 2)}

Generate a response following the rules above.`

  try {
    const result = await chatModel.generateContent([{ text: prompt }], {
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    })

    const responseText = result.response.text()

    // Extract JSON from response
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/\n?```/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/\n?```/g, '')
    }

    const parsed = JSON.parse(jsonText)
    return GeminiChatResponseSchema.parse(parsed)
  } catch (error) {
    console.error('Error generating chat response with Gemini:', error)
    throw new Error('Failed to generate chat response')
  }
}
