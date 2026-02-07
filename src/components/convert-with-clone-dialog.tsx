/**
 * Convert With Clone Dialog
 *
 * Allows users to select a completed music generation and convert
 * its vocals using a voice clone's trained RVC model.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Loader2, Music2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface ConvertWithCloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voiceCloneId: string
  voiceCloneName: string
}

interface Generation {
  id: string
  title: string | null
  prompt: string
  audioUrl: string | null
  audioDurationMs: number | null
  createdAt: Date
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number | null): string {
  if (!ms) return ''
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Component
// ============================================================================

export function ConvertWithCloneDialog({
  open,
  onOpenChange,
  voiceCloneId,
  voiceCloneName,
}: ConvertWithCloneDialogProps) {
  const queryClient = useQueryClient()
  const [selectedGenerationId, setSelectedGenerationId] = useState<
    string | null
  >(null)
  const [pitchShift, setPitchShift] = useState(0)

  // Fetch completed generations
  const { data: generations, isLoading: isLoadingGenerations } = useQuery({
    queryKey: ['completed-generations'],
    queryFn: async () => {
      const { listCompletedGenerationsFn } = await import('@/server/voice.fn')
      return listCompletedGenerationsFn()
    },
    enabled: open,
  })

  // Start conversion mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGenerationId) {
        throw new Error('Please select a track')
      }
      const { startConversionWithCloneFn } = await import('@/server/voice.fn')
      return startConversionWithCloneFn({
        data: {
          voiceCloneId,
          sourceGenerationId: selectedGenerationId,
          pitchShift: pitchShift !== 0 ? pitchShift : undefined,
        },
      })
    },
    onSuccess: () => {
      toast.success('Voice conversion started!')
      queryClient.invalidateQueries({ queryKey: ['voice-conversions'] })
      onOpenChange(false)
      setSelectedGenerationId(null)
      setPitchShift(0)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start conversion')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Convert Track with "{voiceCloneName}"</DialogTitle>
          <DialogDescription>
            Select a completed music track to convert its vocals using this
            voice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-0">
          {/* Track Selection */}
          <div className="space-y-2">
            <Label>Select a Track</Label>
            {isLoadingGenerations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : generations && generations.length > 0 ? (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto rounded-lg border p-1.5">
                {generations.map((gen: Generation) => (
                  <button
                    key={gen.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors',
                      selectedGenerationId === gen.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50',
                    )}
                    onClick={() => setSelectedGenerationId(gen.id)}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                      <Music2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {gen.title || gen.prompt.slice(0, 50)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(gen.createdAt)}
                        {gen.audioDurationMs
                          ? ` - ${formatDuration(gen.audioDurationMs)}`
                          : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No completed tracks found. Generate some music first!
              </div>
            )}
          </div>

          {/* Pitch Shift */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pitch Shift</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {pitchShift > 0 ? '+' : ''}
                {pitchShift} semitones
              </span>
            </div>
            <Slider
              value={[pitchShift]}
              onValueChange={([v]) => setPitchShift(v)}
              min={-12}
              max={12}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust the pitch of the converted voice. 0 = no change.
            </p>
          </div>
        </div>

        {/* Cost estimate */}
        <p className="text-[11px] text-muted-foreground">
          Estimated cost: ~$0.02-0.05 per conversion on Replicate (RVC v2)
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => convertMutation.mutate()}
            disabled={!selectedGenerationId || convertMutation.isPending}
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Convert Track
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
