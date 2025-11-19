import { z } from 'zod'

// User role types
export type UserRole = 'admin' | 'user'

export interface UserRoleData {
  user_id: string
  role: UserRole
  created_at: string
}

// Asset metadata enums
export const UsageRights = z.enum([
  'internal_only',
  'web_approved',
  'print_approved',
  'all_channels',
])
export type UsageRights = z.infer<typeof UsageRights>

export const AssetStatus = z.enum(['draft', 'approved', 'archived'])
export type AssetStatus = z.infer<typeof AssetStatus>

// Gemini Vision Response Schema
export const GeminiVisionResponseSchema = z.object({
  summary: z.string(),
  subjects: z.array(z.string()),
  mood: z.array(z.string()),
  setting: z.object({
    environment: z.string(),
    time_of_day: z.string(),
    weather: z.string(),
  }),
  composition: z.object({
    orientation: z.string(),
    shot_type: z.string(),
    focus: z.string(),
  }),
  usage: z.object({
    typical_channels: z.array(z.string()),
    tone: z.array(z.string()),
  }),
  keywords: z.array(z.string()),
})

export type GeminiVisionResponse = z.infer<typeof GeminiVisionResponseSchema>

// Asset metadata schema for form inputs
export const AssetMetadataSchema = z.object({
  // Optional external references
  dam_id: z.string().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal('')),
  file_name: z.string().optional().nullable(),
  acquired_at: z.string().optional().nullable(),

  // Required metadata
  usage_rights: UsageRights,
  status: AssetStatus,
  image_purchase_date: z.string(),
  image_capture_date: z.string(),
  license_type_usage: z.string().min(1, 'License type usage is required'),
  license_type_subscription: z.string().min(1, 'License type subscription is required'),

  // Optional metadata
  partner: z.string().optional().nullable(),
  client: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  collection: z.string().optional().nullable(),
  region_representation: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
})

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>

// Complete asset schema (database record)
export const AssetSchema = z.object({
  id: z.string().uuid(),
  storage_path: z.string(),
  preview_path: z.string(),
  mime_type: z.string().optional().nullable(),
  llm_description: z.string(),
  llm_metadata: z.record(z.any()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().optional().nullable(),
}).merge(AssetMetadataSchema)

export type Asset = z.infer<typeof AssetSchema>

// Generated asset data (response from /api/admin/generate-description)
export const GeneratedAssetDataSchema = z.object({
  storage_path: z.string(),
  preview_path: z.string(),
  preview_url: z.string(),
  llm_description: z.string(),
  llm_metadata: GeminiVisionResponseSchema,
  tags: z.array(z.string()),
  mime_type: z.string(),
})

export type GeneratedAssetData = z.infer<typeof GeneratedAssetDataSchema>

// Ingest request schema
export const IngestRequestSchema = GeneratedAssetDataSchema.merge(AssetMetadataSchema)

export type IngestRequest = z.infer<typeof IngestRequestSchema>

// Chat message types
export const ChatMessageRoleSchema = z.enum(['user', 'assistant'])
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>

// Asset reference in chat responses
export const BrandonAssetSchema = z.object({
  id: z.string().uuid(),
  dam_id: z.string().optional().nullable(),
  file_name: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  preview_path: z.string(),
  label: z.string(),
  reason: z.string(),
})

export type BrandonAsset = z.infer<typeof BrandonAssetSchema>

// Chat message schema
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  assets: z.array(BrandonAssetSchema).optional().nullable(),
  created_at: z.string(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

// Chat request/response types
export const ChatRequestMessageSchema = z.object({
  role: ChatMessageRoleSchema,
  content: z.string(),
})

export const ChatRequestSchema = z.object({
  messages: z.array(ChatRequestMessageSchema),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// Gemini chat response schema
export const GeminiChatResponseSchema = z.object({
  assistant_message: z.string(),
  assets: z.array(BrandonAssetSchema),
})

export type GeminiChatResponse = z.infer<typeof GeminiChatResponseSchema>

// Pinecone metadata schema
export interface PineconeMetadata {
  assetId: string
  dam_id?: string | null
  file_name?: string | null
  url?: string | null
  preview_path: string
  llm_description: string
  tags?: string[]
  usage_rights: string
  status: string
  license_type_usage: string
  license_type_subscription: string
  brand?: string | null
  collection?: string | null
  region_representation?: string | null
  partner?: string | null
  client?: string | null
  location?: string | null
  campaign?: string | null
  image_purchase_date: number // ms since epoch
  image_capture_date: number // ms since epoch
}

// SSE event types for progressive updates
export type ChatStatusEvent =
  | { type: 'status'; status: string; data?: Record<string, any> }
  | { type: 'result'; assistant_message: string; assets: BrandonAsset[] }

// Rate limit types
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}
