# CLAUDE.md - Brandon AI Assistant Guide

**Last Updated**: November 2025

This document provides comprehensive guidance for AI assistants working on the Brandon codebase. It covers architecture, conventions, workflows, and best practices.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Codebase Structure](#codebase-structure)
4. [Development Workflows](#development-workflows)
5. [Key Conventions & Patterns](#key-conventions--patterns)
6. [API Documentation](#api-documentation)
7. [Database Schema](#database-schema)
8. [Authentication & Authorization](#authentication--authorization)
9. [AI/LLM Integration](#aillm-integration)
10. [Common Tasks](#common-tasks)
11. [Troubleshooting Guide](#troubleshooting-guide)

---

## Project Overview

**Brandon** is an AI-powered brand asset management assistant that enables users to find brand images stored in a Digital Asset Management (DAM) system using natural language queries.

### Core Capabilities

- **Natural Language Search**: Users ask questions like "Show me the latest autonomous driving technology visuals" and Brandon retrieves relevant assets
- **AI-Powered Analysis**: Gemini Vision analyzes uploaded images to generate rich, structured descriptions
- **Role-Based Access**: Admin users can ingest assets; end-users can search and discover
- **Progressive UX**: Real-time status updates during search operations
- **Recency-Aware Ranking**: Combines semantic similarity with asset acquisition date for optimal results

### Business Context

Brandon targets **automotive and technology brands** with focus on:
- Corporate communications (investor decks, press releases)
- Marketing campaigns (social media, websites, annual reports)
- Premium/lifestyle imagery with specific aesthetic requirements

---

## Architecture & Tech Stack

### Frontend

- **Framework**: Next.js 14+ with App Router (`app/` directory)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui with Modern Minimal theme
- **Key Libraries**:
  - `@radix-ui/*` - Accessible UI primitives
  - `lucide-react` - Icon system
  - `class-variance-authority` + `clsx` + `tailwind-merge` - Style utilities
  - `date-fns` - Date formatting

### Backend

- **Runtime**: Next.js API Routes (App Router)
- **Auth & Database**: Supabase (PostgreSQL + Auth)
- **File Storage**: Supabase Storage (two buckets: `assets-full`, `assets-preview`)
- **Vector Database**: Pinecone (cosine similarity, 3072 dimensions)
- **LLM Provider**: Google Gemini 3 Pro Preview (`gemini-3-pro-preview`)
- **Embeddings**: OpenAI `text-embedding-3-large` (3072 dimensions)
- **Image Processing**: Sharp (preview generation)

### Data Flow

```
ADMIN INGESTION:
Upload Image → Supabase Storage → Generate Preview (Sharp) →
Gemini Vision Analysis → Generate Description → Create Embedding (OpenAI) →
Save to Supabase + Upsert to Pinecone

USER SEARCH:
User Query → Generate Embedding (OpenAI) → Pinecone Vector Search →
Re-rank by Recency → Gemini Chat Response → Display Results
```

---

## Codebase Structure

```
brandon/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (no layout)
│   │   ├── login/page.tsx        # Login page
│   │   └── signup/page.tsx       # Signup page
│   ├── admin/                    # Admin-only routes
│   │   ├── layout.tsx            # Admin auth guard
│   │   ├── page.tsx              # Admin dashboard
│   │   └── ingest/page.tsx       # Asset ingestion interface
│   ├── api/                      # API routes
│   │   ├── admin/
│   │   │   ├── generate-description/route.ts  # Step 1: Generate AI description
│   │   │   └── ingest/route.ts                # Step 2: Ingest to DB + Pinecone
│   │   ├── chat/route.ts         # Chat endpoint (SSE streaming)
│   │   └── history/route.ts      # Load/clear chat history
│   ├── globals.css               # Global styles + Tailwind directives
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main chat interface
│
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   └── toast.tsx
│   ├── asset-card.tsx            # Asset display component
│   └── thinking-indicator.tsx    # Loading/status indicator
│
├── lib/                          # Shared utilities
│   ├── auth-helpers.ts           # Auth utilities (requireAdmin, etc.)
│   ├── gemini.ts                 # Gemini API client
│   ├── image-processing.ts       # Sharp image utilities
│   ├── openai.ts                 # OpenAI API client (embeddings)
│   ├── pinecone.ts               # Pinecone client
│   ├── rate-limit.ts             # Rate limiting (in-memory)
│   ├── supabase-browser.ts       # Supabase client (browser)
│   ├── supabase-server.ts        # Supabase client (server)
│   ├── types.ts                  # TypeScript types + Zod schemas
│   └── utils.ts                  # Utility functions (cn, etc.)
│
├── supabase-schema.sql           # Database schema (user_roles, assets, chat_messages)
├── .env.example                  # Environment variables template
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration (strict mode)
└── Claude_master-prompt.md       # Original product specification
```

---

## Development Workflows

### Setup for Development

1. **Clone and Install**:
   ```bash
   git clone <repo-url>
   cd brandon
   npm install
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env.local`
   - Add Supabase credentials (URL, anon key, service role key)
   - Add OpenAI API key
   - Add Gemini API key
   - Add Pinecone credentials (API key, index name)

3. **Set Up Supabase**:
   - Run `supabase-schema.sql` in Supabase SQL Editor
   - Verify buckets created: `assets-full`, `assets-preview`
   - Check RLS policies are active

4. **Set Up Pinecone**:
   - Create index: `brandon-assets`
   - Dimensions: `3072`
   - Metric: `cosine`

5. **Run Development Server**:
   ```bash
   npm run dev
   ```

### Git Workflow

- **Main Branch**: `main` (or as specified in git context)
- **Feature Branches**: Use `claude/<descriptive-name>-<session-id>` format
- **Commits**: Clear, descriptive messages following conventional commits style
- **Pull Requests**: Include summary, test plan, and screenshots if UI changes

### Code Quality Standards

- **TypeScript**: All files must be TypeScript with strict mode
- **Linting**: Run `npm run lint` before committing
- **Validation**: Use Zod schemas for all API inputs/outputs
- **Error Handling**: Comprehensive try-catch blocks with meaningful error messages
- **Security**: Never expose service role key client-side; validate all user inputs

---

## Key Conventions & Patterns

### TypeScript Patterns

1. **Always Use Zod Schemas**:
   ```typescript
   // Define schema in lib/types.ts
   export const MySchema = z.object({...})
   export type MyType = z.infer<typeof MySchema>

   // Validate in API routes
   const validated = MySchema.parse(body)
   ```

2. **Server vs Browser Supabase Clients**:
   ```typescript
   // Browser (components, client-side)
   import { createClient } from '@/lib/supabase-browser'

   // Server (API routes, server components)
   import { createServerClient } from '@/lib/supabase-server'
   ```

3. **Auth Helpers**:
   ```typescript
   import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

   // In admin API routes
   const user = await requireAdmin(supabase) // Throws if not admin
   ```

### File Organization

- **API Routes**: Use `route.ts` (App Router convention)
- **Client Components**: Use `'use client'` directive at top
- **Server Components**: Default; no directive needed
- **Utilities**: Keep pure functions in `lib/`
- **Types**: Centralize in `lib/types.ts`

### Styling Conventions

- **Tailwind Only**: No CSS modules or styled-components
- **Component Variants**: Use `class-variance-authority` for variants
- **cn Utility**: Always use `cn()` from `lib/utils.ts` to merge classes
  ```typescript
  import { cn } from '@/lib/utils'
  <div className={cn("base-class", conditional && "conditional-class", className)} />
  ```

### Error Handling Pattern

```typescript
// API routes
try {
  // Validate input
  const validated = MySchema.parse(body)

  // Perform operation
  const result = await someOperation(validated)

  // Return success
  return NextResponse.json({ success: true, data: result })
} catch (error) {
  console.error('Error in operation:', error)

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation error', details: error.errors },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  )
}
```

---

## API Documentation

### Authentication

All API routes require authentication via Supabase Auth. Admin routes additionally verify the `admin` role.

**Headers**:
- Standard Supabase auth headers (handled by SDK)

### Rate Limiting

- **Limit**: 20 requests per minute per user
- **Implementation**: In-memory store in `lib/rate-limit.ts`
- **Response on Limit**: 429 status with retry-after timestamp

---

### POST /api/chat

**Purpose**: Chat with Brandon to search assets

**Auth**: Required (any authenticated user)

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "Show me autonomous driving images" },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**: Server-Sent Events (SSE) stream

**Event Types**:
1. Status events:
   ```json
   { "type": "status", "status": "Analyzing your query..." }
   { "type": "status", "status": "Searching through 1,247 assets..." }
   { "type": "status", "status": "Found 23 potential matches" }
   { "type": "status", "status": "Ranking by relevance and recency..." }
   { "type": "status", "status": "Generating response..." }
   ```

2. Result event:
   ```json
   {
     "type": "result",
     "assistant_message": "I found several autonomous driving images...",
     "assets": [
       {
         "id": "uuid",
         "dam_id": "...",
         "file_name": "...",
         "url": "https://...",
         "preview_path": "...",
         "label": "Autonomous vehicle sensor array",
         "reason": "Matches your request for autonomous driving technology"
       }
     ]
   }
   ```

**Processing Flow**:
1. Authenticate user
2. Rate limit check
3. Save user message to DB
4. Generate query embedding (OpenAI)
5. Search Pinecone (top 30)
6. Re-rank by recency (80% similarity + 20% recency)
7. Call Gemini for response
8. Save assistant message
9. Return results

---

### GET /api/history

**Purpose**: Load chat history for current user

**Auth**: Required

**Response**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "role": "user",
      "content": "...",
      "assets": null,
      "created_at": "2025-11-19T..."
    }
  ]
}
```

---

### DELETE /api/history

**Purpose**: Clear all chat history for current user

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "message": "Chat history cleared"
}
```

---

### POST /api/admin/generate-description

**Purpose**: Upload image and generate AI description (Step 1 of ingestion)

**Auth**: Admin only

**Request**: `multipart/form-data`
- `image`: File (JPEG, PNG, WebP)
- `metadata`: JSON string with metadata fields

**Response**:
```json
{
  "storage_path": "abc123.jpg",
  "preview_path": "abc123_preview.jpg",
  "preview_url": "https://...supabase.co/storage/v1/object/...",
  "llm_description": "A sleek autonomous vehicle driving through...",
  "llm_metadata": {
    "summary": "...",
    "subjects": ["autonomous vehicle", "urban environment"],
    "mood": ["futuristic", "innovative"],
    "setting": {...},
    "composition": {...},
    "usage": {...},
    "keywords": [...]
  },
  "tags": ["autonomous", "vehicle", "futuristic", ...],
  "mime_type": "image/jpeg"
}
```

**Processing**:
1. Validate admin role
2. Upload full image to `assets-full` bucket
3. Generate preview with Sharp (800px width, 80% quality)
4. Upload preview to `assets-preview` bucket
5. Call Gemini Vision with structured prompt
6. Parse JSON response with `responseSchema`
7. Build description and extract tags
8. Return data for review

---

### POST /api/admin/ingest

**Purpose**: Ingest reviewed asset to database and Pinecone (Step 2)

**Auth**: Admin only

**Request**:
```json
{
  "storage_path": "abc123.jpg",
  "preview_path": "abc123_preview.jpg",
  "llm_description": "...",
  "llm_metadata": {...},
  "tags": [...],
  "mime_type": "image/jpeg",

  // Required metadata
  "usage_rights": "web_approved",
  "status": "approved",
  "image_purchase_date": "2025-11-19T00:00:00Z",
  "image_capture_date": "2025-11-15T00:00:00Z",
  "license_type_usage": "royalty_free",
  "license_type_subscription": "premium",

  // Optional metadata
  "dam_id": "...",
  "url": "...",
  "file_name": "...",
  "partner": "Getty Images",
  "client": "Q4 Campaign",
  "brand": "Audi",
  "collection": "EV Series",
  "region_representation": "European",
  "location": "Munich",
  "campaign": "Electric Future"
}
```

**Response**:
```json
{
  "success": true,
  "asset_id": "uuid",
  "message": "Asset ingested successfully and ready for search"
}
```

**Processing**:
1. Validate admin role
2. Validate request with Zod schema
3. Insert into `assets` table
4. Generate embedding for `llm_description`
5. Upsert to Pinecone with metadata
6. Return success

---

## Database Schema

### user_roles

```sql
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Maps users to roles (admin vs end-user)

**RLS Policies**:
- Users can read their own role
- Service role can manage all roles

**First-User-Admin Logic**: Implemented in signup flow - if `user_roles` table is empty, new user gets `admin` role.

---

### assets

```sql
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File references (optional)
  dam_id text,
  file_name text,
  url text,

  -- Storage paths (required)
  storage_path text NOT NULL,
  preview_path text NOT NULL,
  mime_type text,

  -- Required metadata
  usage_rights text NOT NULL CHECK (usage_rights IN ('internal_only', 'web_approved', 'print_approved', 'all_channels')),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',
  image_purchase_date timestamptz NOT NULL,
  image_capture_date timestamptz NOT NULL,
  license_type_usage text NOT NULL,
  license_type_subscription text NOT NULL,

  -- Optional metadata
  partner text,
  client text,
  brand text,
  collection text,
  region_representation text,
  location text,
  campaign text,

  -- LLM-generated content
  llm_description text NOT NULL,
  llm_metadata jsonb,
  tags text[],

  -- Audit
  acquired_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
```

**Key Indexes**:
- `idx_assets_status` on `status`
- `idx_assets_purchase_date` on `image_purchase_date DESC`
- `idx_assets_brand` on `brand`
- `idx_assets_region` on `region_representation`

**RLS Policies**:
- All authenticated users can read `approved` assets
- Admins can read/insert/update/delete all assets
- Service role has full access

**Trigger**: Auto-update `updated_at` on UPDATE

---

### chat_messages

```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  assets jsonb,  -- Array of BrandonAsset objects for assistant messages
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Stores per-user chat history

**RLS Policies**:
- Users can read/insert/delete only their own messages

**Index**: `idx_chat_messages_user_created` on `(user_id, created_at DESC)`

---

### Supabase Storage

**Buckets**:
- `assets-full`: Full-quality images (private)
- `assets-preview`: Preview images (private)

**RLS Policies**:
- Admins can upload to both buckets
- All authenticated users can read from both buckets

---

## Authentication & Authorization

### Auth Flow

1. **Signup** (`/signup`):
   - User submits email + password
   - Supabase Auth creates user
   - Check if first user → assign `admin` role
   - Otherwise assign `user` role
   - Insert into `user_roles` table
   - Redirect to chat

2. **Login** (`/login`):
   - User submits credentials
   - Supabase Auth validates
   - Session cookie set automatically
   - Redirect to chat (or admin dashboard if admin)

3. **Session Management**:
   - Handled by Supabase Auth SDK
   - Refresh tokens managed automatically
   - Check session in middleware/layouts

### Role-Based Access

**Admin Role**:
- Access to `/admin/*` routes
- Can call `/api/admin/*` endpoints
- Can upload and manage assets
- Can chat with Brandon

**User Role**:
- Access to `/` (chat interface)
- Can call `/api/chat` and `/api/history`
- Cannot access admin routes/APIs

### Implementation

```typescript
// lib/auth-helpers.ts
export async function requireAdmin(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return user
}
```

**Usage in API Routes**:
```typescript
const supabase = createServerClient()
const user = await requireAdmin(supabase) // Throws if not admin
```

**Admin Layout Guard** (`app/admin/layout.tsx`):
```typescript
// Check role on client-side
// Redirect to chat if not admin
```

---

## AI/LLM Integration

### Gemini Integration

**Model**: `gemini-3-pro-preview`

**Best Practices** (per Google's Gemini 3 recommendations):

1. **PTCF Framework**: All prompts use Persona-Task-Context-Format structure with XML tags
2. **Structured JSON Output**: Use `responseSchema` parameter for guaranteed valid JSON
3. **Temperature**: Use default (1.0) for optimal instruction following
4. **System Instructions**: Define persona/rules via `systemInstruction` parameter
5. **Image Ordering**: Place images before text in multimodal calls

#### Vision API (Asset Analysis)

**File**: `lib/gemini.ts`

**Function**: `analyzeImageWithGemini(imageBuffer, mimeType, metadata)`

**Prompt Structure**:
```xml
<persona>You are an expert image analyst for automotive and technology brands</persona>

<task>Analyze this brand asset image and provide structured metadata</task>

<context>
This image is part of a corporate DAM system. Users include marketing teams,
PR departments, and executives who need precise, searchable descriptions.
</context>

<format>
Return JSON matching this schema:
{
  "summary": "One-sentence description",
  "subjects": ["primary", "secondary"],
  "mood": ["descriptor1", "descriptor2"],
  "setting": {...},
  "composition": {...},
  "usage": {...},
  "keywords": [...]
}
</format>
```

**Response Schema** (enforced via `responseSchema`):
```typescript
const schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    subjects: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mood: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    setting: {
      type: SchemaType.OBJECT,
      properties: {
        environment: { type: SchemaType.STRING },
        time_of_day: { type: SchemaType.STRING },
        weather: { type: SchemaType.STRING }
      }
    },
    // ... full schema
  },
  required: ['summary', 'subjects', 'mood', 'setting', 'composition', 'usage', 'keywords']
}
```

**Call Pattern**:
```typescript
const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBuffer.toString('base64')
        }
      },
      { text: prompt }
    ]
  }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: schema
  }
})

const parsed = JSON.parse(result.response.text())
```

#### Chat API (Asset Selection)

**File**: `app/api/chat/route.ts`

**System Instruction**:
```typescript
const systemInstruction = `
<persona>
You are Brandon, an AI assistant specialized in automotive and technology brand assets.
You are knowledgeable, precise, and understand corporate communications needs.
</persona>

<rules>
- Use ONLY the provided asset candidates
- Never invent URLs, IDs, or asset details
- Prefer assets with higher combinedScore
- If user mentions "latest", "new", "recent", prioritize image_purchase_date
- If no good matches exist, explain and suggest refining the query
- Respond conversationally but professionally
</rules>

<output_format>
Return ONLY valid JSON:
{
  "assistant_message": "Your conversational response",
  "assets": [
    {
      "id": "uuid",
      "dam_id": "...",
      "file_name": "...",
      "url": "...",
      "preview_path": "...",
      "label": "Short descriptive label",
      "reason": "Why this matches the request"
    }
  ]
}
</output_format>
`
```

**Response Schema**:
```typescript
const chatResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    assistant_message: { type: SchemaType.STRING },
    assets: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          dam_id: { type: SchemaType.STRING, nullable: true },
          file_name: { type: SchemaType.STRING, nullable: true },
          url: { type: SchemaType.STRING, nullable: true },
          preview_path: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING }
        },
        required: ['id', 'preview_path', 'label', 'reason']
      }
    }
  },
  required: ['assistant_message', 'assets']
}
```

### OpenAI Integration

**Model**: `text-embedding-3-large` (3072 dimensions)

**File**: `lib/openai.ts`

**Function**: `generateEmbedding(text: string)`

**Usage**:
```typescript
import { openai } from '@/lib/openai'

const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text
})

const vector = embedding.data[0].embedding // Array of 3072 numbers
```

**Used For**:
1. Embedding `llm_description` during asset ingestion
2. Embedding user queries during search

### Pinecone Integration

**Index Config**:
- Name: `brandon-assets` (configurable via env)
- Dimensions: 3072
- Metric: cosine
- Cloud: AWS (or as configured)

**File**: `lib/pinecone.ts`

**Upsert Pattern**:
```typescript
await pineconeIndex.upsert([{
  id: asset.id,
  values: embedding,
  metadata: {
    assetId: asset.id,
    preview_path: asset.preview_path,
    llm_description: asset.llm_description,
    tags: asset.tags,
    usage_rights: asset.usage_rights,
    status: asset.status,
    brand: asset.brand,
    collection: asset.collection,
    region_representation: asset.region_representation,
    partner: asset.partner,
    client: asset.client,
    location: asset.location,
    campaign: asset.campaign,
    image_purchase_date: new Date(asset.image_purchase_date).getTime(),
    image_capture_date: new Date(asset.image_capture_date).getTime()
  }
}])
```

**Query Pattern**:
```typescript
const results = await pineconeIndex.query({
  vector: queryEmbedding,
  topK: 30,
  includeMetadata: true,
  filter: {
    status: { $eq: 'approved' }
    // Additional filters as needed
  }
})
```

**Recency Re-ranking**:
```typescript
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000
const now = Date.now()
const ALPHA = 0.8 // Semantic weight

results.matches.forEach(match => {
  const purchaseDateMs = match.metadata.image_purchase_date
  const age = now - purchaseDateMs
  const recencyScore = Math.max(0, 1 - (age / THREE_YEARS_MS))

  match.combinedScore = ALPHA * match.score + (1 - ALPHA) * recencyScore
})

results.matches.sort((a, b) => b.combinedScore - a.combinedScore)
const topCandidates = results.matches.slice(0, 10)
```

---

## Common Tasks

### Adding a New Asset Field

1. **Update Database Schema**:
   ```sql
   ALTER TABLE assets ADD COLUMN new_field text;
   CREATE INDEX IF NOT EXISTS idx_assets_new_field ON assets(new_field);
   ```

2. **Update TypeScript Types** (`lib/types.ts`):
   ```typescript
   export const AssetMetadataSchema = z.object({
     // ...existing fields
     new_field: z.string().optional().nullable(),
   })
   ```

3. **Update Pinecone Metadata** (`lib/pinecone.ts`):
   ```typescript
   metadata: {
     // ...existing fields
     new_field: asset.new_field,
   }
   ```

4. **Update Admin UI** (`app/admin/ingest/page.tsx`):
   - Add form field
   - Update state management
   - Update submission payload

5. **Update API Routes**:
   - `app/api/admin/ingest/route.ts`: Include in insert/upsert

### Adding a New shadcn/ui Component

```bash
# Use the CLI to add components
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
```

Components will be added to `components/ui/`. They're fully editable.

### Modifying Search Algorithm

**File**: `app/api/chat/route.ts`

**Re-ranking Logic** (line ~120):
```typescript
// Adjust ALPHA to change semantic vs recency balance
const ALPHA = 0.8 // 80% semantic, 20% recency

// Adjust time window for recency calculation
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000
```

**Pinecone Query Filters** (line ~90):
```typescript
const results = await pineconeIndex.query({
  vector: queryEmbedding,
  topK: 30, // Increase for more candidates
  includeMetadata: true,
  filter: {
    status: { $eq: 'approved' },
    // Add custom filters:
    // brand: { $eq: 'Audi' },
    // region_representation: { $in: ['European', 'Global'] }
  }
})
```

### Debugging Gemini Responses

1. **Enable Logging**:
   ```typescript
   console.log('Gemini prompt:', prompt)
   console.log('Gemini response:', result.response.text())
   ```

2. **Validate Schema**:
   ```typescript
   try {
     const parsed = GeminiVisionResponseSchema.parse(JSON.parse(responseText))
   } catch (error) {
     console.error('Schema validation failed:', error)
     // Response doesn't match expected structure
   }
   ```

3. **Check API Quota**:
   - Google AI Studio: https://ai.google.dev/
   - View quota usage in dashboard

### Testing Embeddings

```typescript
// In a test file or API route
import { openai } from '@/lib/openai'

const text = "autonomous vehicle driving through urban environment"
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text
})

console.log('Embedding dimensions:', embedding.data[0].embedding.length) // Should be 3072
console.log('Sample values:', embedding.data[0].embedding.slice(0, 10))
```

### Clearing Pinecone Index

```typescript
// WARNING: This deletes all vectors
import { pineconeIndex } from '@/lib/pinecone'

await pineconeIndex.deleteAll()
```

---

## Troubleshooting Guide

### Images Not Loading

**Symptom**: Preview images show broken or don't load

**Causes**:
1. Storage bucket not created
2. RLS policies blocking access
3. Incorrect Supabase URL in env

**Fix**:
```bash
# Verify buckets exist in Supabase Dashboard > Storage
# Check RLS policies in supabase-schema.sql are applied
# Verify NEXT_PUBLIC_SUPABASE_URL is correct (must be public)
```

---

### Gemini API Errors

**Symptom**: 400/403 errors from Gemini

**Causes**:
1. Invalid API key
2. Quota exceeded
3. Model name incorrect
4. Response schema too strict

**Fix**:
```typescript
// Verify model name
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

// Check API key is valid
// Visit https://ai.google.dev/

// Temporarily disable responseSchema to see raw response
// generationConfig: {
//   responseMimeType: 'application/json',
//   // responseSchema: schema // Comment out for debugging
// }
```

---

### Pinecone Connection Issues

**Symptom**: Timeout or connection errors

**Causes**:
1. Invalid API key
2. Incorrect index name
3. Index dimensions mismatch
4. Network issues

**Fix**:
```bash
# Verify index exists and dimensions match
# Pinecone Dashboard > Indexes > brandon-assets
# Check dimensions: 3072
# Check metric: cosine

# Verify PINECONE_API_KEY and PINECONE_INDEX_NAME in .env.local
```

---

### Rate Limit Errors

**Symptom**: 429 status, "Rate limit exceeded"

**Cause**: User exceeded 20 requests/minute

**Fix**:
```typescript
// Adjust limit in lib/rate-limit.ts
const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 50 // Increase if needed
}
```

---

### First User Not Admin

**Symptom**: First signup doesn't get admin role

**Cause**: Signup logic failed or user_roles table not empty

**Fix**:
```sql
-- Check user_roles table
SELECT * FROM user_roles;

-- If needed, manually set admin
UPDATE user_roles SET role = 'admin' WHERE user_id = '<user-uuid>';

-- Or clear and re-signup
DELETE FROM user_roles;
DELETE FROM auth.users;
```

---

### TypeScript Errors After Schema Change

**Symptom**: Type errors after updating Zod schemas

**Fix**:
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P > "TypeScript: Restart TS Server"

# Or restart dev server
npm run dev
```

---

### SSE Stream Disconnects

**Symptom**: Chat status updates stop mid-stream

**Causes**:
1. Network timeout
2. Vercel function timeout (10s default)
3. Client-side connection closed

**Fix**:
```typescript
// Increase timeout in vercel.json
{
  "functions": {
    "app/api/chat/route.ts": {
      "maxDuration": 30
    }
  }
}

// Add reconnection logic on client
eventSource.onerror = () => {
  eventSource.close()
  // Retry logic
}
```

---

## Additional Resources

### External Documentation

- **Next.js App Router**: https://nextjs.org/docs/app
- **Supabase**: https://supabase.com/docs
- **Pinecone**: https://docs.pinecone.io/
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **Gemini API**: https://ai.google.dev/docs
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/docs

### Internal Files

- **Product Spec**: `Claude_master-prompt.md`
- **Database Schema**: `supabase-schema.sql`
- **Environment Template**: `.env.example`
- **Project README**: `README.md`

---

## AI Assistant Guidelines

When working on this codebase as an AI assistant:

1. **Always Use Types**: Leverage the Zod schemas in `lib/types.ts`
2. **Validate Inputs**: Parse all API inputs with Zod before processing
3. **Handle Errors**: Use try-catch and provide meaningful error messages
4. **Follow Conventions**: Match existing patterns for consistency
5. **Security First**: Never expose service keys client-side
6. **Test Incrementally**: Test changes in isolation before integration
7. **Document Changes**: Update this file if adding major features
8. **Ask Before Breaking**: Clarify requirements if changes would break existing functionality

### Common Pitfalls to Avoid

- Don't use browser Supabase client in API routes (use server client)
- Don't forget to validate admin role in admin endpoints
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` client-side
- Don't modify Pinecone metadata without updating TypeScript types
- Don't skip Zod validation "for speed"
- Don't use relative imports (use `@/` aliases)
- Don't add inline styles (use Tailwind classes)

---

**End of CLAUDE.md**

*This document should be updated whenever significant architectural changes are made to the Brandon codebase.*
