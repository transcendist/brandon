import { Loader2 } from 'lucide-react'

interface ThinkingIndicatorProps {
  status: string
}

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex-1 pt-1">
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  )
}
