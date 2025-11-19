import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeMetadata } from './types'

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set')
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME is not set')
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
})

const indexName = process.env.PINECONE_INDEX_NAME

export function getPineconeIndex() {
  return pinecone.index(indexName)
}

export async function upsertVector(
  id: string,
  embedding: number[],
  metadata: PineconeMetadata
) {
  try {
    const index = getPineconeIndex()

    await index.upsert([
      {
        id,
        values: embedding,
        metadata: metadata as Record<string, any>,
      },
    ])

    return { success: true }
  } catch (error) {
    console.error('Error upserting vector to Pinecone:', error)
    throw new Error('Failed to upsert vector')
  }
}

export async function queryVectors(
  embedding: number[],
  topK: number = 30,
  filter?: Record<string, any>
) {
  try {
    const index = getPineconeIndex()

    const queryRequest: any = {
      vector: embedding,
      topK,
      includeMetadata: true,
    }

    if (filter) {
      queryRequest.filter = filter
    }

    const results = await index.query(queryRequest)

    return results.matches || []
  } catch (error) {
    console.error('Error querying Pinecone:', error)
    throw new Error('Failed to query vectors')
  }
}

export async function deleteVector(id: string) {
  try {
    const index = getPineconeIndex()
    await index.deleteOne(id)
    return { success: true }
  } catch (error) {
    console.error('Error deleting vector from Pinecone:', error)
    throw new Error('Failed to delete vector')
  }
}
