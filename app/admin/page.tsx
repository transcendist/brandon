'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, MessageSquare, ArrowLeft } from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Asset Ingestion
              </CardTitle>
              <CardDescription>
                Upload and manage brand assets for Brandon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload images, generate AI descriptions, and make them searchable
                in Brandon's chat interface.
              </p>
              <Button onClick={() => router.push('/admin/ingest')}>
                Ingest Assets
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Brandon Chat
              </CardTitle>
              <CardDescription>
                Test asset search and chat functionality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Return to the main chat interface to test searching for assets
                and interact with Brandon.
              </p>
              <Button variant="outline" onClick={() => router.push('/')}>
                Go to Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
