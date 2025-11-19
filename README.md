# Brandon - AI-Powered Brand Asset Assistant

Brandon is an LLM-powered brand asset management assistant that helps users find brand images stored in a Digital Asset Management (DAM) system using natural language queries.

## Overview

Brandon combines modern AI technologies to provide an intelligent, conversational interface for searching and discovering brand assets. Users can ask questions like "Show me the latest autonomous driving technology visuals for the investor deck" and Brandon will find and present the most relevant images from your asset library.

### Key Features

- Natural language search for brand assets
- AI-powered image analysis and description generation
- Role-based access control (Admin vs End-user)
- Progressive status updates during search
- Two-step asset ingestion process (generate → review → ingest)
- Recency-aware search ranking
- Rich metadata support

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Modern Minimal theme)
- **Auth & Database**: Supabase
- **File Storage**: Supabase Storage
- **Vector Database**: Pinecone
- **LLM**: Gemini 3 Pro Preview (Google Generative AI)
- **Embeddings**: OpenAI text-embedding-3-large
- **Deployment**: Vercel

## Architecture

### Data Flow

```
1. Admin Ingestion:
   Upload Image → Generate Preview → Gemini Vision Analysis →
   Generate Description → Create Embedding → Save to Supabase + Pinecone

2. User Search:
   User Query → Generate Embedding → Pinecone Search →
   Re-rank by Recency → Gemini Chat Response → Display Results
```

### Authentication & RBAC

- **Supabase Auth**: Email/password authentication
- **Two Roles**:
  - **Admin**: Can upload/manage assets, access admin dashboard, chat with Brandon
  - **End-user**: Can only chat with Brandon
- **First-user-admin**: The first user to sign up automatically becomes an admin

### Database Schema

- **user_roles**: Maps users to roles (admin/user)
- **assets**: Stores asset metadata and references
- **chat_messages**: Stores conversation history per user

## Prerequisites

Before you begin, ensure you have:

1. Node.js 18+ installed
2. A Supabase account and project
3. An OpenAI API key
4. A Google AI (Gemini) API key
5. A Pinecone account and index

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd brandon
npm install
```

### 2. Set Up Supabase

#### Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

#### Run Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase-schema.sql`
4. Run the SQL script

This will create:
- `user_roles` table with RLS policies
- `assets` table with RLS policies
- `chat_messages` table with RLS policies
- Storage buckets (`assets-full`, `assets-preview`)
- Storage RLS policies

#### Create Storage Buckets

If not created by the SQL script:

1. Go to Storage in Supabase dashboard
2. Create bucket `assets-full` (private)
3. Create bucket `assets-preview` (private)

### 3. Set Up Pinecone

1. Go to [https://www.pinecone.io](https://www.pinecone.io)
2. Create a new index with these settings:
   - **Name**: `brandon-assets` (or your preferred name)
   - **Dimensions**: 3072 (for text-embedding-3-large)
   - **Metric**: cosine
3. Note your API key and index name

### 4. Get API Keys

#### OpenAI
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key

#### Google Gemini
1. Go to [https://ai.google.dev](https://ai.google.dev)
2. Get your API key from Google AI Studio

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=brandon-assets
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Create Your First Admin User

1. Go to [http://localhost:3000/signup](http://localhost:3000/signup)
2. Sign up with your email and password
3. The first user automatically becomes an admin
4. You'll be redirected to the chat interface

## Usage

### For End-Users (Chat Interface)

1. **Sign in** at `/login`
2. **Ask Brandon** to find assets using natural language:
   - "Show me the latest autonomous driving technology visuals for the investor deck"
   - "I need a premium SUV lifestyle shot, outdoor setting, golden hour lighting"
   - "Find factory floor images with robotic assembly, industrial aesthetic"
3. **View results**: Brandon will display matching assets with previews, labels, and reasons
4. **Clear history**: Click "Clear History" to delete your chat messages

### For Admins (Asset Ingestion)

1. **Access Admin Dashboard**: Click "Ingest Assets" button in chat header
2. **Navigate to Ingestion**: `/admin/ingest`

#### Step 1: Upload & Generate

1. Upload an image file (JPEG, PNG, or WebP)
2. Fill in required metadata:
   - Usage Rights
   - Status
   - Image Purchase Date
   - Image Capture Date
   - License Type (Usage)
   - License Type (Subscription)
3. Optionally add metadata:
   - DAM ID, URL, File Name
   - Partner, Client, Brand
   - Collection, Region, Location, Campaign
4. Click "Generate Description"

Brandon will:
- Upload full image to Supabase Storage
- Generate preview image
- Analyze image with Gemini Vision
- Generate structured description and metadata

#### Step 2: Review & Ingest

1. Review the generated description
2. Edit description or metadata JSON if needed
3. Review extracted tags
4. Click "Ingest Asset"

Brandon will:
- Save asset to Supabase database
- Generate embedding for description
- Upsert to Pinecone vector database
- Make asset searchable in chat

## API Routes

### `/api/chat` (POST)
- **Purpose**: Chat endpoint with progressive status updates
- **Auth**: Required
- **Input**: Chat messages array
- **Output**: Server-Sent Events stream with status updates and results
- **Rate Limit**: 20 requests per minute per user

### `/api/history` (GET)
- **Purpose**: Load chat history
- **Auth**: Required
- **Output**: Array of chat messages for current user

### `/api/history` (DELETE)
- **Purpose**: Clear chat history
- **Auth**: Required
- **Output**: Success confirmation

### `/api/admin/generate-description` (POST)
- **Purpose**: Generate AI description for uploaded image
- **Auth**: Admin only
- **Input**: Multipart form data (image + metadata)
- **Output**: Generated description, metadata, preview URL

### `/api/admin/ingest` (POST)
- **Purpose**: Ingest asset to database and Pinecone
- **Auth**: Admin only
- **Input**: Asset data with metadata
- **Output**: Success confirmation with asset ID

## Progressive Status Updates

During chat searches, Brandon provides real-time status updates:

1. "Analyzing your query..."
2. "Searching through X assets..."
3. "Found X potential matches"
4. "Ranking by relevance and recency..."
5. "Generating response..."

This provides transparency and a better user experience during the search process.

## Search & Ranking Algorithm

Brandon uses a hybrid search approach:

1. **Semantic Search**: Query is embedded and compared against asset descriptions in Pinecone
2. **Metadata Filtering**: Filter by status (approved), usage rights, region, brand, etc.
3. **Recency Re-ranking**:
   - Combines semantic similarity (80% weight) with recency score (20% weight)
   - Recency score based on `image_purchase_date`
   - Favors assets acquired within the last 3 years
4. **LLM Selection**: Gemini selects and explains the best matches

## Deployment to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**:
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Configure Environment Variables**:
   - Go to Vercel dashboard → Project Settings → Environment Variables
   - Add all variables from `.env.local`

4. **Deploy**:
   ```bash
   vercel --prod
   ```

## Project Structure

```
brandon/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── signup/page.tsx         # Signup page
│   ├── admin/
│   │   ├── layout.tsx              # Admin auth guard
│   │   ├── page.tsx                # Admin dashboard
│   │   └── ingest/page.tsx         # Asset ingestion UI
│   ├── api/
│   │   ├── admin/
│   │   │   ├── generate-description/route.ts
│   │   │   └── ingest/route.ts
│   │   ├── chat/route.ts           # Chat endpoint (SSE)
│   │   └── history/route.ts        # Chat history
│   ├── globals.css                 # Global styles
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Chat interface
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── asset-card.tsx              # Asset display component
│   └── thinking-indicator.tsx     # Status indicator
├── lib/
│   ├── auth-helpers.ts             # Auth utilities
│   ├── gemini.ts                   # Gemini API client
│   ├── image-processing.ts        # Image utilities (Sharp)
│   ├── openai.ts                   # OpenAI API client
│   ├── pinecone.ts                 # Pinecone client
│   ├── rate-limit.ts               # Rate limiting
│   ├── supabase-browser.ts        # Supabase browser client
│   ├── supabase-server.ts         # Supabase server client
│   ├── types.ts                    # TypeScript types
│   └── utils.ts                    # Utility functions
├── supabase-schema.sql            # Database schema
├── .env.example                    # Environment variables template
├── next.config.js                  # Next.js configuration
├── package.json                    # Dependencies
├── tailwind.config.ts              # Tailwind configuration
└── tsconfig.json                   # TypeScript configuration
```

## Troubleshooting

### Images Not Loading

- Check Supabase Storage buckets are created
- Verify storage RLS policies are set correctly
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is set

### Gemini API Errors

- Verify your Gemini API key is valid
- Check you have quota remaining
- Note: Model is `gemini-3-pro-preview`

### Pinecone Connection Issues

- Verify index dimensions are 3072
- Check index name matches `PINECONE_INDEX_NAME`
- Ensure API key has write permissions

### First User Not Admin

- Delete user from Supabase Auth users table
- Clear `user_roles` table
- Sign up again as first user

### Rate Limit Errors

- Rate limit is 20 requests/minute per user
- Wait for reset time indicated in error
- Adjust limit in `lib/rate-limit.ts` if needed

## Security Considerations

- All API routes require authentication
- Admin routes verify admin role
- RLS policies enforce data access control
- Service role key only used server-side
- Rate limiting prevents abuse
- File uploads validated for type and size

## Future Enhancements

- Image tagging and auto-categorization
- Bulk asset upload
- Asset editing and deletion
- Advanced search filters in UI
- Asset usage tracking
- Multi-language support
- Video asset support

## License

MIT

## Support

For issues or questions, please open an issue on GitHub or contact the development team.
