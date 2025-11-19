import { BrandonAsset } from '@/lib/types'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface AssetCardProps {
  asset: BrandonAsset
}

export function AssetCard({ asset }: AssetCardProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previewUrl = asset.preview_path && supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/assets-preview/${asset.preview_path}`
    : '/placeholder.png'

  return (
    <Card className="w-64 flex-shrink-0">
      <CardHeader className="p-0">
        <div className="relative aspect-video overflow-hidden rounded-t-lg">
          <img
            src={previewUrl}
            alt={asset.label}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/placeholder.png'
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-2">{asset.label}</h3>
        <p className="text-xs text-muted-foreground mb-2">{asset.reason}</p>
        <p className="text-xs text-muted-foreground">
          {asset.dam_id ? `DAM ID: ${asset.dam_id}` : `ID: ${asset.id.slice(0, 8)}...`}
        </p>
      </CardContent>
      {asset.url && (
        <CardFooter className="p-4 pt-0">
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={asset.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-2" />
              Open in DAM
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
