```markdown
You are an expert full-stack engineer.
Your task is to design and implement an MVP web app called Brandon, an LLM-powered brand asset assistant.
Brandon helps users find brand images stored in a DAM by chatting in natural language.

## Reference Documentation

Consult these official docs as needed:
- **Pinecone**: https://docs.pinecone.io/guides/get-started/overview
- **Vercel**: https://vercel.com/docs
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **Supabase**: https://supabase.com/docs
- **Supabase Storage**: https://supabase.com/docs/guides/storage
- **Tailwind CSS**: https://v2.tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/
- **shadcn Theme (Modern Minimal)**: https://www.shadcn.io/theme/modern-minimal

## 1. Tech stack & general constraints

### Tech stack
- Framework: Next.js 14+ with the App Router (app/ directory)
- Language: TypeScript (strict mode enabled)
- Styling: Tailwind CSS
- UI components: shadcn/ui (use Modern Minimal theme as inspiration)
- Auth & main DB: Supabase
- File storage: Supabase Storage (for uploaded images and generated previews)
- Vector DB: Pinecone
- LLM for reasoning: Gemini 3 Pro Preview (Google Gen AI API) - model: `gemini-3-pro-preview`
- Embeddings: OpenAI text-embedding-3-large
- Deployment target: Vercel

### General rules
- Use TypeScript everywhere with `strict: true` in tsconfig.json.
- Use the App Router (app/) conventions.
- Keep all secrets in environment variables.
- Organise code:
  - `lib/` for clients and shared utilities
  - `app/api/` for API routes
  - `components/` for UI components
  - `app/admin/` for admin-only pages
- Code should be production-ready and easy to extend.

## 2. Core product: what Brandon does

Brandon is a logged-in, per-user chat app with role-based access control (RBAC).

### User roles

**Admin:**
- Access to ingestion interface to upload and manage assets
- Can view/edit/delete assets
- Two-step ingestion process: generate JSON → review → ingest
- Can chat with Brandon

**End-user:**
- Can only chat with Brandon
- Cannot access ingestion tools
- Cannot modify assets

### User experience (End-users)

1. User visits the site:
   - If not authenticated, redirect to a login / sign-up page.
   - If authenticated, show the Brandon chat UI.

2. The user types queries like:
   - "Show me the latest autonomous driving technology visuals for the investor deck"
   - "I need a premium SUV lifestyle shot, outdoor setting, golden hour lighting"
   - "Find factory floor images with robotic assembly, industrial aesthetic"
   - "Show me corporate headquarters exterior shots for the press release"

3. Backend processing with progressive status updates:
   - Show "Analyzing your query..." while embedding query
   - Show "Searching through X assets..." while querying Pinecone
   - Show "Found X potential matches" after Pinecone returns results
   - Show "Ranking by relevance and recency..." during re-ranking
   - Show "Generating response..." while calling Gemini
   
   Backend steps:
   - Computes embedding for the query (text-embedding-3-large).
   - Queries Pinecone for similar assets based on text.
   - Applies metadata filters (brand, collection, status, usage rights, region).
   - Re-ranks results by recency of acquisition (image_purchase_date).
   - Calls Gemini 3 Pro Preview to generate a conversational answer using only the retrieved assets.

4. Frontend:
   - Shows Brandon's reply as a chat bubble.
   - Renders asset cards (thumbnail preview, label, reason, link).
   - Displays progressive loading states during API calls (see step 3).
   - Handles errors gracefully with retry options.

All messages (user + assistant) are stored as chat history per user in Supabase and reloaded on next visit.

### Admin experience

**Two-step ingestion process:**

**Step 1: Generate & Review (app/admin/ingest/page.tsx)**

Admin interface with form:
- Upload full-quality image file (drag & drop or file picker)
- Enter metadata:
  - Optional: `dam_id`, `url` (DAM link), `file_name`, `acquired_at`
  - Required: `usage_rights`, `status`, `image_purchase_date`, `image_capture_date`, `license_type_usage`, `license_type_subscription`
  - Optional: `partner`, `client`, `brand`, `collection`, `region_representation`, `location`, `campaign`

On "Generate Description" click:
- Upload full image to Supabase Storage
- Auto-generate preview image (lower resolution)
- Store preview in Supabase Storage
- Call Gemini Vision API to analyze image and generate structured JSON description
- Display preview card showing:
  - Preview image
  - Generated JSON (editable)
  - All metadata fields
  - "Edit JSON" and "Ingest Asset" buttons

**Step 2: Ingest**

After reviewing/editing:
- Admin clicks "Ingest Asset"
- System:
  - Saves asset record to Supabase `assets` table
  - Generates embedding for `llm_description`
  - Upserts to Pinecone with metadata
  - Shows confirmation: "Asset ingested successfully and ready for search"
  - Provides link to test in Brandon chat

## 3. Auth & user model (Supabase)

Use Supabase Auth for login and sign-up with role-based access control.

### 3.1. Auth

Support email + password sign-up and login (simple MVP).

Create:
- `app/(auth)/login/page.tsx` – login form
- `app/(auth)/signup/page.tsx` – sign-up form

Each form should:
- Use Supabase JS client in the browser (@supabase/supabase-js).
- On success, redirect to `/` (chat for end-users, admin dashboard for admins).
- Show basic error messages on failure.
- Include loading states during authentication.

### 3.2. Role assignment

For MVP, use simple approach:
- First user to sign up becomes admin automatically
- Or manually set role in Supabase UI

Create `user_roles` table:

```sql
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage roles (for first-user-admin logic)
CREATE POLICY "Service role can manage roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**First user becomes admin:**
Implement in signup flow:
```typescript
// After user signs up
const { count } = await supabase
  .from('user_roles')
  .select('*', { count: 'exact', head: true });

const role = count === 0 ? 'admin' : 'user'; // First user = admin

await supabase
  .from('user_roles')
  .insert({ user_id: newUser.id, role });
```

### 3.3. Protecting routes

**Chat page (`app/page.tsx`):**
- Requires authentication
- Accessible to both admin and user roles

**Admin pages (`app/admin/*`):**
- Requires authentication AND admin role
- Redirect non-admins to chat page with error message

Create middleware or layout checks:
```typescript
// lib/auth-helpers.ts
export async function requireAdmin(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  
  if (roleData?.role !== 'admin') {
    throw new Error('Admin access required');
  }
  
  return user;
}
```

Create helpers:
- `lib/supabase-browser.ts` – for client usage (auth forms).
- `lib/supabase-server.ts` – for server usage (RLS-safe, uses service key only on server).

## 4. Data model (Supabase)

Supabase will hold:
- Assets (images and their metadata)
- Chat messages (per user chat history)
- User roles (admin vs end-user)

### 4.1. assets table

Create a table `assets` with updated schema:

```sql
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- File references (all optional - Brandon can be source of truth)
  dam_id text,                    -- Optional: External DAM identifier
  file_name text,                 -- Optional: Original file name
  url text,                       -- Optional: Link to external DAM
  
  -- Supabase Storage paths (generated by system)
  storage_path text NOT NULL,     -- Path to full-quality image in Supabase Storage
  preview_path text NOT NULL,     -- Path to preview image in Supabase Storage
  mime_type text,
  
  -- REQUIRED metadata
  usage_rights text NOT NULL CHECK (usage_rights IN ('internal_only', 'web_approved', 'print_approved', 'all_channels')),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',
  image_purchase_date timestamptz NOT NULL,     -- When company purchased/licensed
  image_capture_date timestamptz NOT NULL,      -- When image was originally captured
  license_type_usage text NOT NULL,             -- e.g., "royalty_free", "rights_managed"
  license_type_subscription text NOT NULL,      -- e.g., "standard", "premium", "enterprise"
  
  -- OPTIONAL metadata
  partner text,                   -- Provider (e.g., "Getty Images", "Internal Studio")
  client text,                    -- Client project (e.g., "Q4 Campaign")
  brand text,                     -- Brand (e.g., "Audi", "Mercedes")
  collection text,                -- Collection name
  region_representation text,     -- Region represented in image (e.g., "European", "Asian", "North American")
  location text,                  -- Shoot location (e.g., "Munich HQ", "Death Valley")
  campaign text,                  -- Campaign name (e.g., "EV Summer Launch")
  
  -- LLM-generated content
  llm_description text NOT NULL,  -- Rich paragraph description
  llm_metadata jsonb,             -- Full JSON from Gemini Vision
  tags text[],                    -- Extracted keywords
  
  -- Legacy/optional
  acquired_at timestamptz,        -- Optional: Alternative to image_purchase_date
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_purchase_date ON assets(image_purchase_date DESC);
CREATE INDEX idx_assets_brand ON assets(brand);
CREATE INDEX idx_assets_region ON assets(region_representation);

-- Enable Row Level Security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read approved assets
CREATE POLICY "Authenticated users can read approved assets"
  ON assets FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- Admins can read all assets
CREATE POLICY "Admins can read all assets"
  ON assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert assets
CREATE POLICY "Admins can insert assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update assets
CREATE POLICY "Admins can update assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete assets
CREATE POLICY "Admins can delete assets"
  ON assets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can manage all assets (for ingestion)
CREATE POLICY "Service role can manage assets"
  ON assets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

Embeddings are not stored here; they go to Pinecone.

### 4.2. chat_messages table (chat history)

```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  assets jsonb, -- For assistant messages: list of asset objects
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only read their own messages
CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert their own messages
CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (for clear history)
CREATE POLICY "Users can delete own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

### 4.3. Supabase Storage setup

Create two storage buckets:

```sql
-- Bucket for full-quality images
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets-full', 'assets-full', false);

-- Bucket for preview images
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets-preview', 'assets-preview', false);

-- RLS policies for assets-full bucket
CREATE POLICY "Admins can upload full images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets-full' AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can view full images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assets-full');

-- RLS policies for assets-preview bucket
CREATE POLICY "Admins can upload preview images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets-preview' AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can view preview images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assets-preview');
```

## 5. Pinecone index & OpenAI embeddings

### 5.1. Pinecone index

Create a Pinecone index (e.g. `brandon-assets`):
- Dimension: 3072 (for text-embedding-3-large)
- Metric: cosine

Each vector:

```json
{
  "id": "<Supabase asset.id as string>",
  "values": [/* embedding numbers */],
  "metadata": {
    "assetId": "<asset.id>",
    "dam_id": "...",
    "file_name": "...",
    "url": "https://...",
    "preview_path": "assets-preview/...",
    "llm_description": "...",
    "tags": ["...", "..."],
    
    "usage_rights": "...",
    "status": "approved",
    "license_type_usage": "...",
    "license_type_subscription": "...",
    
    "brand": "...",
    "collection": "...",
    "region_representation": "...",
    "partner": "...",
    "client": "...",
    "location": "...",
    "campaign": "...",
    
    "image_purchase_date": 1700000000000,  // ms since epoch
    "image_capture_date": 1690000000000    // ms since epoch
  }
}
```

### 5.2. Embeddings

Use the official OpenAI Node SDK:
- Model: text-embedding-3-large

During ingestion:
- Embed `llm_description` and write to Pinecone.

During search:
- Embed user query text and query Pinecone.

## 6. Admin ingestion pipeline

### 6.1. Overview

Two-step process with dedicated UI:

**Step 1: Generate (app/api/admin/generate-description/route.ts)**
- Accept uploaded image + metadata
- Upload to Supabase Storage
- Generate preview image
- Call Gemini Vision for description
- Return JSON + preview URL

**Step 2: Ingest (app/api/admin/ingest/route.ts)**
- Accept reviewed JSON + metadata
- Save to `assets` table
- Generate embedding
- Upsert to Pinecone
- Return confirmation

### 6.2. API Route: Generate Description

**File:** `app/api/admin/generate-description/route.ts`

**Method:** POST (multipart/form-data)

**Request:**
- `image`: File (uploaded image)
- `metadata`: JSON string with all metadata fields

**Steps:**

1. **Authenticate and verify admin role**
2. **Upload full image to Supabase Storage:**
   ```typescript
   const fileName = `${uuidv4()}.${ext}`;
   const { data: uploadData } = await supabase.storage
     .from('assets-full')
     .upload(fileName, imageFile);
   ```

3. **Generate preview image:**
   ```typescript
   // Use Sharp library to resize
   const previewBuffer = await sharp(imageBuffer)
     .resize(800, null, { withoutEnlargement: true })
     .jpeg({ quality: 80 })
     .toBuffer();
   
   const previewFileName = `${uuidv4()}_preview.jpg`;
   await supabase.storage
     .from('assets-preview')
     .upload(previewFileName, previewBuffer);
   ```

4. **Generate description with Gemini Vision:**
   ```typescript
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

Be specific and detailed. Focus on automotive and technology contexts.`;

   const result = await model.generateContent([
     {
       inlineData: {
         mimeType: imageFile.type,
         data: imageBuffer.toString('base64')
       }
     },
     { text: prompt }
   ]);
   
   const geminiResponse = JSON.parse(result.response.text());
   ```

5. **Build llm_description and tags:**
   ```typescript
   const llmDescription = `${geminiResponse.summary}. 
     This image features ${geminiResponse.subjects.join(', ')} with a ${geminiResponse.mood.join(', ')} mood. 
     The setting is ${geminiResponse.setting.environment} during ${geminiResponse.setting.time_of_day}. 
     Composition: ${geminiResponse.composition.orientation} orientation, ${geminiResponse.composition.shot_type} shot.
     Suitable for ${geminiResponse.usage.typical_channels.join(', ')}.`;
   
   const tags = [
     ...geminiResponse.subjects,
     ...geminiResponse.mood,
     ...geminiResponse.keywords
   ];
   ```

6. **Return response:**
   ```json
   {
     "storage_path": "full-image-path",
     "preview_path": "preview-image-path",
     "preview_url": "https://...supabase.co/storage/...",
     "llm_description": "Generated description",
     "llm_metadata": { /* full Gemini JSON */ },
     "tags": ["tag1", "tag2"],
     "mime_type": "image/jpeg"
   }
   ```

### 6.3. API Route: Ingest Asset

**File:** `app/api/admin/ingest/route.ts`

**Method:** POST

**Request body:**
```json
{
  "storage_path": "...",
  "preview_path": "...",
  "llm_description": "...",
  "llm_metadata": {},
  "tags": [],
  "mime_type": "...",
  
  // Required fields
  "usage_rights": "...",
  "status": "...",
  "image_purchase_date": "ISO date",
  "image_capture_date": "ISO date",
  "license_type_usage": "...",
  "license_type_subscription": "...",
  
  // Optional fields
  "dam_id": "...",
  "url": "...",
  "file_name": "...",
  "acquired_at": "ISO date",
  "partner": "...",
  "client": "...",
  "brand": "...",
  "collection": "...",
  "region_representation": "...",
  "location": "...",
  "campaign": "..."
}
```

**Steps:**

1. **Authenticate and verify admin role**
2. **Validate required fields (use Zod)**
3. **Insert into assets table:**
   ```typescript
   const { data: asset } = await supabase
     .from('assets')
     .insert({
       storage_path,
       preview_path,
       llm_description,
       llm_metadata,
       tags,
       mime_type,
       usage_rights,
       status,
       image_purchase_date,
       image_capture_date,
       license_type_usage,
       license_type_subscription,
       region_representation,
       // ... optional fields
       created_by: user.id
     })
     .select()
     .single();
   ```

4. **Generate embedding:**
   ```typescript
   const embedding = await openai.embeddings.create({
     model: 'text-embedding-3-large',
     input: llm_description
   });
   ```

5. **Upsert to Pinecone:**
   ```typescript
   await pinecone.upsert([{
     id: asset.id,
     values: embedding.data[0].embedding,
     metadata: {
       assetId: asset.id,
       dam_id: asset.dam_id,
       file_name: asset.file_name,
       url: asset.url,
       preview_path: asset.preview_path,
       llm_description: asset.llm_description,
       tags: asset.tags,
       usage_rights: asset.usage_rights,
       status: asset.status,
       region_representation: asset.region_representation,
       // ... all searchable metadata
       image_purchase_date: new Date(asset.image_purchase_date).getTime(),
       image_capture_date: new Date(asset.image_capture_date).getTime()
     }
   }]);
   ```

6. **Return success:**
   ```json
   {
     "success": true,
     "asset_id": "uuid",
     "message": "Asset ingested successfully and ready for search in Brandon"
   }
   ```

## 7. Chat backend (/api/chat) with progressive status updates

Create a Next.js App Router API route:
- File: `app/api/chat/route.ts`
- Method: POST

### 7.1. Progressive status updates

Use **Server-Sent Events (SSE)** or streaming response to send progressive status updates to the frontend:

```typescript
// Response headers for SSE
headers: {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
}

// Send status updates
function sendStatus(status: string, data?: any) {
  return `data: ${JSON.stringify({ type: 'status', status, ...data })}\n\n`;
}

function sendResult(result: any) {
  return `data: ${JSON.stringify({ type: 'result', ...result })}\n\n`;
}
```

**Status messages to send:**
1. `"Analyzing your query..."` - Before embedding
2. `"Searching through X assets..."` - Before Pinecone query (include total asset count)
3. `"Found X potential matches"` - After Pinecone returns results
4. `"Ranking by relevance and recency..."` - During re-ranking
5. `"Generating response..."` - Before Gemini call

### 7.2. Rate limiting

```typescript
const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 20
};
```

### 7.3. Request shape

```json
{
  "messages": [
    { "role": "user" | "assistant", "content": "string" }
  ]
}
```

### 7.4. Steps with status updates

**1. Authenticate user**

**2. Apply rate limiting**

**3. Extract latest user message**

**4. Save user message to Supabase**

**5. Send status: "Analyzing your query..."**

**6. Embed the user query**

**7. Get total asset count and send status:**
```typescript
const { count: totalAssets } = await supabase
  .from('assets')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'approved');

// Send: "Searching through 1,247 assets..."
```

**8. Query Pinecone:**
- `topK`: 30
- `includeMetadata`: true
- Apply metadata filters:
  - **Status:** Only `status = 'approved'`
  - **Usage rights:** Based on user context (if available)
  - **Region:** Consider region_representation if specified
  - **Brand/Collection/Campaign:** If mentioned in query

**9. Send status: "Found X potential matches"**
```typescript
// After Pinecone returns
// Send: "Found 23 potential matches"
```

**10. Send status: "Ranking by relevance and recency..."**

**11. Recency-aware re-ranking using `image_purchase_date`:**

```typescript
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const now = Date.now();

candidates.forEach(candidate => {
  const purchaseDateMs = candidate.metadata.image_purchase_date;
  const age = now - purchaseDateMs;
  const recencyScore = Math.max(0, 1 - (age / THREE_YEARS_MS));
  
  const ALPHA = 0.8; // Semantic similarity weight
  candidate.combinedScore = ALPHA * candidate.score + (1 - ALPHA) * recencyScore;
});

// Sort by combinedScore descending
candidates.sort((a, b) => b.combinedScore - a.combinedScore);

// Keep top 10
const topCandidates = candidates.slice(0, 10);
```

**12. Send status: "Generating response..."**

**13. Call Gemini 3 Pro Preview:**

System instruction:
```
You are Brandon, an AI assistant that helps users find automotive and technology brand images.

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

Return ONLY valid JSON. No markdown, no extra text.
```

**14. Parse Gemini response and validate with Zod**

**15. Persist assistant message**

**16. Send final result to frontend**

### 7.5. Frontend integration for status updates

On the frontend, handle SSE stream:

```typescript
const eventSource = new EventSource('/api/chat');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'status') {
    // Update status indicator in UI
    setStatusMessage(data.status);
  } else if (data.type === 'result') {
    // Display final result
    setMessages([...messages, data]);
    eventSource.close();
  }
};
```

**UI component for status:**
```tsx
{isThinking && (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm">{statusMessage}</span>
  </div>
)}
```

## 8. Chat history API

**File:** `app/api/history/route.ts`

**GET:** Load chat history
- Authenticate user
- Query `chat_messages` for current user
- Order by `created_at ASC`
- Return message array

**DELETE:** Clear chat history (`app/api/history/clear/route.ts`)
- Authenticate user
- Delete all `chat_messages` for current user
- Return success

## 9. Frontend implementation

### 9.1. Pages structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── admin/
│   ├── layout.tsx (requires admin role)
│   ├── page.tsx (admin dashboard)
│   └── ingest/page.tsx (ingestion interface)
└── page.tsx (chat interface)
```

### 9.2. Admin ingestion UI (app/admin/ingest/page.tsx)

**Layout:**

```
┌─────────────────────────────────────────┐
│  Brandon Admin - Asset Ingestion        │
├─────────────────────────────────────────┤
│                                         │
│  [Step 1: Upload & Generate]            │
│  ┌───────────────────────────────────┐  │
│  │  Drop image here or click         │  │
│  │  [Upload Zone]                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Required Metadata:                     │
│  ├─ Usage Rights: [dropdown]            │
│  ├─ Status: [dropdown]                  │
│  ├─ Purchase Date: [date picker]        │
│  ├─ Capture Date: [date picker]         │
│  ├─ License Type (Usage): [input]       │
│  └─ License Type (Subscription): [input]│
│                                         │
│  Optional Metadata: [Expandable]        │
│  ├─ DAM ID: [input]                     │
│  ├─ URL: [input]                        │
│  ├─ File Name: [input]                  │
│  ├─ Partner: [input]                    │
│  ├─ Client: [input]                     │
│  ├─ Brand: [input]                      │
│  ├─ Collection: [input]                 │
│  ├─ Region Representation: [input]      │
│  ├─ Location: [input]                   │
│  └─ Campaign: [input]                   │
│                                         │
│  [Generate Description] button          │
│                                         │
│  ────────────────────────────────────   │
│                                         │
│  [Step 2: Review & Ingest]              │
│  (Appears after generation)             │
│  ┌───────────────────────────────────┐  │
│  │  ┌─────────┐                      │  │
│  │  │ Preview │  Generated JSON:     │  │
│  │  │  Image  │  {                   │  │
│  │  │         │    "summary": "...", │  │
│  │  └─────────┘    "subjects": [...] │  │
│  │                  ...               │  │
│  │                }                   │  │
│  │                                    │  │
│  │  [Edit JSON]  [Ingest Asset]      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Success: ✓ Asset ready for Brandon!   │
│  [View in Chat]                         │
└─────────────────────────────────────────┘
```

**Implementation:**

```typescript
// State management
const [step, setStep] = useState<'upload' | 'review'>('upload');
const [uploadedFile, setUploadedFile] = useState<File | null>(null);
const [metadata, setMetadata] = useState<AssetMetadata>({...});
const [generatedData, setGeneratedData] = useState<GeneratedAssetData | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [isIngesting, setIsIngesting] = useState(false);

// Step 1: Generate
async function handleGenerate() {
  setIsGenerating(true);
  
  const formData = new FormData();
  formData.append('image', uploadedFile);
  formData.append('metadata', JSON.stringify(metadata));
  
  const response = await fetch('/api/admin/generate-description', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  setGeneratedData(data);
  setStep('review');
  setIsGenerating(false);
}

// Step 2: Ingest
async function handleIngest() {
  setIsIngesting(true);
  
  const response = await fetch('/api/admin/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...generatedData,
      ...metadata
    })
  });
  
  const result = await response.json();
  // Show success message
  setIsIngesting(false);
}
```

### 9.3. Chat UI (app/page.tsx) with progressive status

**On mount:**
1. Show skeleton loader
2. Fetch `/api/history`
3. Render messages
4. Handle errors with retry

**User interaction:**
1. Optimistic update on send
2. Show progressive status indicators:
   - "Analyzing your query..."
   - "Searching through 1,247 assets..."
   - "Found 23 potential matches"
   - "Ranking by relevance and recency..."
   - "Generating response..."
3. POST to `/api/chat` (SSE stream)
4. Update status message as events arrive
5. Append assistant response with asset cards when complete
6. Error handling with retry button

**Status indicator component:**
```tsx
function ThinkingIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex-1 pt-1">
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
```

**Asset cards:**
```typescript
function AssetCard({ asset }: { asset: BrandonAsset }) {
  const previewUrl = asset.preview_path 
    ? `${supabaseUrl}/storage/v1/object/public/assets-preview/${asset.preview_path}`
    : '/placeholder.png';
  
  return (
    <Card className="w-64">
      <CardHeader>
        <img 
          src={previewUrl} 
          alt={asset.label}
          className="aspect-video object-cover rounded"
        />
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold">{asset.label}</h3>
        <p className="text-sm text-muted-foreground">{asset.reason}</p>
        <p className="text-xs mt-2">
          {asset.dam_id ? `DAM ID: ${asset.dam_id}` : `ID: ${asset.id}`}
        </p>
      </CardContent>
      <CardFooter>
        {asset.url && (
          <Button asChild variant="outline" size="sm">
            <a href={asset.url} target="_blank">
              Open in DAM
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

**UI Features:**
- Auto-scroll to bottom
- "Clear History" button
- Logout button
- Role indicator (show "Admin" badge if user is admin)
- Progressive status updates during processing

## 10. Environment & config

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Gemini
GEMINI_API_KEY=your_gemini_key

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=brandon-assets
```

Create `.env.local.example` with placeholders.

### Helper modules

- `lib/supabase-browser.ts`
- `lib/supabase-server.ts`
- `lib/auth-helpers.ts` (role checking)
- `lib/openai.ts`
- `lib/gemini.ts`
- `lib/pinecone.ts`
- `lib/rate-limit.ts`
- `lib/image-processing.ts` (Sharp for preview generation)

## 11. Quality & documentation

### 11.1. Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.38.0",
    "@google/generative-ai": "latest",
    "@pinecone-database/pinecone": "latest",
    "openai": "^4.0.0",
    "sharp": "^0.32.0",
    "zod": "^3.22.0",
    "tailwindcss": "^3.3.0",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "latest"
  }
}
```

### 11.2. Code quality

- ESLint + Prettier
- TypeScript `strict: true`
- Zod validation for all API inputs/outputs
- Comprehensive error handling

### 11.3. Edge cases

- No Pinecone matches: helpful message
- Missing preview: placeholder image
- API failures: retry options
- Rate limiting: clear error messages
- Role-based redirects
- Image upload size limits
- Storage quota monitoring
- SSE connection errors: fallback to polling

### 11.4. README.md

Include:

1. **Overview**
   - Brandon's purpose
   - Tech stack
   - Role-based access

2. **Setup**
   - Prerequisites
   - Environment variables
   - Supabase setup (tables, RLS, storage)
   - Pinecone index creation
   - First admin setup

3. **Usage**
   - Admin: ingestion workflow
   - End-users: chat interface with progressive status

4. **Architecture**
   - Data flow diagrams
   - Auth & RBAC
   - Ingestion pipeline
   - Search & retrieval with status updates

5. **Deployment**
   - Vercel deployment
   - Environment variables
   - Production considerations

## 12. Final implementation checklist

1. ✅ Next.js 14+ with TypeScript strict mode
2. ✅ Tailwind + shadcn/ui (Modern Minimal)
3. ✅ Supabase: auth, tables, RLS, storage
4. ✅ User roles: admin vs end-user
5. ✅ Pinecone + OpenAI embeddings
6. ✅ Gemini 3 Pro Preview with Vision
7. ✅ Two-step admin ingestion UI
8. ✅ Image upload + preview generation
9. ✅ `/api/admin/generate-description`
10. ✅ `/api/admin/ingest`
11. ✅ `/api/chat` with progressive status updates (SSE)
12. ✅ `/api/history` (GET & DELETE)
13. ✅ Login/signup pages
14. ✅ Chat UI with progressive status indicators (no emojis)
15. ✅ Admin dashboard
16. ✅ Rate limiting
17. ✅ Error handling
18. ✅ Zod validation
19. ✅ Region representation (optional field)
20. ✅ Comprehensive README

## Final instruction

Implement this app step-by-step with:

- Clear, production-ready code
- Proper TypeScript types
- Comprehensive error handling
- Helpful comments
- Focus on automotive/corporate brand context
- Professional UI with Modern Minimal aesthetic
- Progressive status updates for better UX (text only, no emojis)

The code should be maintainable and easy to extend.
```