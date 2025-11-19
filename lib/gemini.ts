import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiVisionResponseSchema, GeminiChatResponseSchema } from './types'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Vision model for image analysis - using Gemini 3 Pro Preview
export const visionModel = genAI.getGenerativeModel({
  model: 'gemini-3-pro-preview',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        subjects: { type: 'array', items: { type: 'string' } },
        mood: { type: 'array', items: { type: 'string' } },
        setting: {
          type: 'object',
          properties: {
            environment: { type: 'string' },
            time_of_day: { type: 'string' },
            weather: { type: 'string' },
          },
          required: ['environment', 'time_of_day', 'weather'],
        },
        composition: {
          type: 'object',
          properties: {
            orientation: { type: 'string' },
            shot_type: { type: 'string' },
            focus: { type: 'string' },
          },
          required: ['orientation', 'shot_type', 'focus'],
        },
        usage: {
          type: 'object',
          properties: {
            typical_channels: { type: 'array', items: { type: 'string' } },
            tone: { type: 'array', items: { type: 'string' } },
          },
          required: ['typical_channels', 'tone'],
        },
        keywords: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'subjects', 'mood', 'setting', 'composition', 'usage', 'keywords'],
    },
  },
})

// Chat model for conversational responses - using Gemini 3 Pro Preview
export const chatModel = genAI.getGenerativeModel({
  model: 'gemini-3-pro-preview',
  systemInstruction: `<persona>
You are Brandon, an AI assistant specialized in finding automotive and technology brand images from a Digital Asset Management system.
</persona>

<task>
Your job is to analyze user queries and select the most relevant brand assets from a provided list of candidates, then explain your selections conversationally.
</task>

<context>
You receive:
- user_query: The user's search request
- candidates: A list of asset objects with metadata including:
  * preview_path, file_name, dam_id, url
  * llm_description, tags, brand, collection
  * usage_rights, partner, client, campaign, location, region_representation
  * image_purchase_date, image_capture_date
  * similarity, recencyScore, combinedScore (ranking metrics)
</context>

<rules>
1. Use ONLY the provided candidates - never invent URLs, IDs, or assets
2. Prefer assets with higher combinedScore values
3. When users mention "latest", "new", or "recent", prioritize assets with more recent image_purchase_date
4. Consider usage_rights and status when recommending assets
5. If no good matches exist, politely explain why and suggest how to refine the query
6. Provide clear, professional explanations for why each asset matches the request
</rules>

<format>
Respond with JSON containing:
- assistant_message: Your conversational response explaining the results
- assets: Array of selected assets with id, dam_id, file_name, url, preview_path, label, and reason
</format>`,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        assistant_message: { type: 'string' },
        assets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              dam_id: { type: 'string', nullable: true },
              file_name: { type: 'string', nullable: true },
              url: { type: 'string', nullable: true },
              preview_path: { type: 'string' },
              label: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['id', 'preview_path', 'label', 'reason'],
          },
        },
      },
      required: ['assistant_message', 'assets'],
    },
  },
})

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<any> {
  const prompt = `<task>
Analyze this automotive/technology brand asset image and provide a comprehensive structured description.
</task>

<context>
This image is part of a Digital Asset Management system for automotive and technology brands. The description will be used for semantic search and asset discovery.
</context>

<instructions>
1. Write a detailed one-sentence summary capturing the essence of the image
2. Identify all primary and secondary subjects visible in the image
3. Describe the mood and emotional tone conveyed
4. Detail the setting including environment, time of day, and weather conditions
5. Analyze the composition including orientation, shot type, and focus
6. Suggest typical use channels and tone descriptors
7. Extract relevant keywords for search optimization
</instructions>

<guidelines>
- Be specific and detailed in descriptions
- Focus on automotive and technology industry contexts
- Use professional terminology appropriate for brand asset management
- Ensure keywords are relevant for search and discovery
</guidelines>

<format>
Provide a JSON response with the structure defined in the response schema.
</format>`

  try {
    // Image is placed before text prompt per Gemini best practices
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

    // With responseSchema, Gemini returns valid JSON directly
    const parsed = JSON.parse(responseText)
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
  const prompt = `<user_query>
${userQuery}
</user_query>

<candidates>
${JSON.stringify(candidates, null, 2)}
</candidates>

<instructions>
Analyze the user query and the provided candidate assets, then:
1. Select the most relevant assets based on combinedScore and relevance to the query
2. Write a conversational response explaining what you found
3. For each selected asset, provide a clear label and explain why it matches the request
4. If no suitable matches exist, explain why and suggest how to refine the search
</instructions>`

  try {
    // System instruction is defined in model configuration
    // Using default temperature (1.0) as recommended for Gemini 3
    const result = await chatModel.generateContent([{ text: prompt }])

    const responseText = result.response.text()

    // With responseSchema, Gemini returns valid JSON directly
    const parsed = JSON.parse(responseText)
    return GeminiChatResponseSchema.parse(parsed)
  } catch (error) {
    console.error('Error generating chat response with Gemini:', error)
    throw new Error('Failed to generate chat response')
  }
}
