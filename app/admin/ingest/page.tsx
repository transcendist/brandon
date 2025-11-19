'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AssetMetadata, GeneratedAssetData, UsageRights, AssetStatus } from '@/lib/types'
import { ArrowLeft, Upload, Loader2, CheckCircle } from 'lucide-react'

export default function IngestPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [metadata, setMetadata] = useState<AssetMetadata>({
    usage_rights: 'internal_only',
    status: 'draft',
    image_purchase_date: new Date().toISOString().split('T')[0],
    image_capture_date: new Date().toISOString().split('T')[0],
    license_type_usage: '',
    license_type_subscription: '',
  })

  const [generatedData, setGeneratedData] = useState<GeneratedAssetData | null>(null)
  const [editedDescription, setEditedDescription] = useState('')
  const [editedMetadata, setEditedMetadata] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showOptionalFields, setShowOptionalFields] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError(null)
    }
  }

  async function handleGenerate() {
    if (!uploadedFile) {
      setError('Please select an image file')
      return
    }

    if (!metadata.license_type_usage || !metadata.license_type_subscription) {
      setError('Please fill in all required fields')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const formData = new FormData()
      formData.append('image', uploadedFile)
      formData.append('metadata', JSON.stringify(metadata))

      const response = await fetch('/api/admin/generate-description', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate description')
      }

      const data: GeneratedAssetData = await response.json()
      setGeneratedData(data)
      setEditedDescription(data.llm_description)
      setEditedMetadata(JSON.stringify(data.llm_metadata, null, 2))
      setStep('review')
    } catch (error: any) {
      setError(error.message || 'Failed to generate description')
      console.error('Generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleIngest() {
    if (!generatedData) return

    setIsIngesting(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Parse edited metadata
      let parsedMetadata
      try {
        parsedMetadata = JSON.parse(editedMetadata)
      } catch {
        setError('Invalid JSON in metadata. Please fix and try again.')
        setIsIngesting(false)
        return
      }

      const ingestPayload = {
        ...generatedData,
        llm_description: editedDescription,
        llm_metadata: parsedMetadata,
        ...metadata,
      }

      const response = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(ingestPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to ingest asset')
      }

      const result = await response.json()
      setIsSuccess(true)
    } catch (error: any) {
      setError(error.message || 'Failed to ingest asset')
      console.error('Ingestion error:', error)
    } finally {
      setIsIngesting(false)
    }
  }

  function resetForm() {
    setStep('upload')
    setUploadedFile(null)
    setPreviewUrl(null)
    setGeneratedData(null)
    setEditedDescription('')
    setEditedMetadata('')
    setIsSuccess(false)
    setError(null)
    setMetadata({
      usage_rights: 'internal_only',
      status: 'draft',
      image_purchase_date: new Date().toISOString().split('T')[0],
      image_capture_date: new Date().toISOString().split('T')[0],
      license_type_usage: '',
      license_type_subscription: '',
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">Asset Ingestion</h1>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {isSuccess ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Asset Ingested Successfully
              </CardTitle>
              <CardDescription>
                The asset is now ready for search in Brandon
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={() => router.push('/')}>View in Chat</Button>
              <Button variant="outline" onClick={resetForm}>
                Ingest Another Asset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Step 1: Upload & Generate */}
            {step === 'upload' && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Upload & Generate Description</CardTitle>
                  <CardDescription>
                    Upload an image and provide metadata to generate an AI description
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="image">Image File</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      {previewUrl ? (
                        <div className="space-y-4">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-64 mx-auto rounded"
                          />
                          <p className="text-sm text-muted-foreground">
                            {uploadedFile?.name}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUploadedFile(null)
                              setPreviewUrl(null)
                            }}
                          >
                            Change Image
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <Input
                              id="image"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <Label
                              htmlFor="image"
                              className="cursor-pointer text-primary hover:underline"
                            >
                              Click to upload
                            </Label>
                            <p className="text-sm text-muted-foreground mt-2">
                              JPEG, PNG, or WebP (max 10MB)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Required Metadata */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Required Metadata</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="usage_rights">Usage Rights</Label>
                        <Select
                          value={metadata.usage_rights}
                          onValueChange={(value: any) =>
                            setMetadata({ ...metadata, usage_rights: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal_only">Internal Only</SelectItem>
                            <SelectItem value="web_approved">Web Approved</SelectItem>
                            <SelectItem value="print_approved">Print Approved</SelectItem>
                            <SelectItem value="all_channels">All Channels</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={metadata.status}
                          onValueChange={(value: any) =>
                            setMetadata({ ...metadata, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purchase_date">Image Purchase Date</Label>
                        <Input
                          type="date"
                          value={metadata.image_purchase_date}
                          onChange={(e) =>
                            setMetadata({
                              ...metadata,
                              image_purchase_date: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capture_date">Image Capture Date</Label>
                        <Input
                          type="date"
                          value={metadata.image_capture_date}
                          onChange={(e) =>
                            setMetadata({
                              ...metadata,
                              image_capture_date: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="license_usage">License Type (Usage)</Label>
                        <Input
                          id="license_usage"
                          placeholder="e.g., royalty_free"
                          value={metadata.license_type_usage}
                          onChange={(e) =>
                            setMetadata({
                              ...metadata,
                              license_type_usage: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="license_subscription">
                          License Type (Subscription)
                        </Label>
                        <Input
                          id="license_subscription"
                          placeholder="e.g., standard"
                          value={metadata.license_type_subscription}
                          onChange={(e) =>
                            setMetadata({
                              ...metadata,
                              license_type_subscription: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Metadata */}
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                    >
                      {showOptionalFields ? 'Hide' : 'Show'} Optional Fields
                    </Button>

                    {showOptionalFields && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="dam_id">DAM ID</Label>
                          <Input
                            id="dam_id"
                            placeholder="Optional"
                            value={metadata.dam_id || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, dam_id: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="url">URL (DAM Link)</Label>
                          <Input
                            id="url"
                            type="url"
                            placeholder="Optional"
                            value={metadata.url || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, url: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="file_name">File Name</Label>
                          <Input
                            id="file_name"
                            placeholder="Optional"
                            value={metadata.file_name || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, file_name: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="partner">Partner</Label>
                          <Input
                            id="partner"
                            placeholder="e.g., Getty Images"
                            value={metadata.partner || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, partner: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client">Client</Label>
                          <Input
                            id="client"
                            placeholder="e.g., Q4 Campaign"
                            value={metadata.client || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, client: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="brand">Brand</Label>
                          <Input
                            id="brand"
                            placeholder="e.g., Audi"
                            value={metadata.brand || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, brand: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="collection">Collection</Label>
                          <Input
                            id="collection"
                            placeholder="Collection name"
                            value={metadata.collection || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, collection: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="region">Region Representation</Label>
                          <Input
                            id="region"
                            placeholder="e.g., European"
                            value={metadata.region_representation || ''}
                            onChange={(e) =>
                              setMetadata({
                                ...metadata,
                                region_representation: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            placeholder="e.g., Munich HQ"
                            value={metadata.location || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, location: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="campaign">Campaign</Label>
                          <Input
                            id="campaign"
                            placeholder="e.g., EV Summer Launch"
                            value={metadata.campaign || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, campaign: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !uploadedFile}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Description...
                      </>
                    ) : (
                      'Generate Description'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Review & Ingest */}
            {step === 'review' && generatedData && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2: Review & Ingest</CardTitle>
                    <CardDescription>
                      Review the generated description and metadata, then ingest the asset
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Preview Image */}
                    <div className="flex justify-center">
                      <img
                        src={generatedData.preview_url}
                        alt="Preview"
                        className="max-h-64 rounded-lg"
                      />
                    </div>

                    {/* LLM Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Generated Description</Label>
                      <Textarea
                        id="description"
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    {/* LLM Metadata JSON */}
                    <div className="space-y-2">
                      <Label htmlFor="metadata">Generated Metadata (JSON)</Label>
                      <Textarea
                        id="metadata"
                        value={editedMetadata}
                        onChange={(e) => setEditedMetadata(e.target.value)}
                        className="min-h-[200px] font-mono text-xs"
                      />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label>Extracted Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {generatedData.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        onClick={handleIngest}
                        disabled={isIngesting}
                        className="flex-1"
                      >
                        {isIngesting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Ingesting Asset...
                          </>
                        ) : (
                          'Ingest Asset'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setStep('upload')}
                        disabled={isIngesting}
                      >
                        Back to Upload
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
