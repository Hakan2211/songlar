'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Mic, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface VoiceConversionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceGenerationId: string
  sourceTitle: string
}

export function VoiceConversionDialog({
  open,
  onOpenChange,
  sourceGenerationId,
  sourceTitle,
}: VoiceConversionDialogProps) {
  const queryClient = useQueryClient()

  // Form state
  const [activeTab, setActiveTab] = useState<'custom' | 'my-voices'>(
    'my-voices',
  )
  const [rvcModelUrl, setRvcModelUrl] = useState('')
  const [rvcModelName, setRvcModelName] = useState('')
  const [pitchShift, setPitchShift] = useState(0)

  // My Voices state
  const [selectedCloneId, setSelectedCloneId] = useState<string | null>(null)

  // Fetch user's voice clones with trained RVC models
  const { data: voiceClones, isLoading: isLoadingClones } = useQuery({
    queryKey: ['voice-clones-for-conversion'],
    queryFn: async () => {
      const { listVoiceClonesFn } = await import('@/server/voice.fn')
      return listVoiceClonesFn()
    },
    enabled: open, // Only fetch when dialog is open
  })

  // Filter to only clones with trained RVC models
  const readyClones = voiceClones?.filter(
    (c) => c.rvcModelStatus === 'ready' && c.rvcModelUrl,
  )

  // Start conversion mutation
  const startConversionMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === 'my-voices') {
        if (!selectedCloneId) {
          throw new Error('Please select a voice clone')
        }
        const { startConversionWithCloneFn } = await import('@/server/voice.fn')
        return startConversionWithCloneFn({
          data: {
            voiceCloneId: selectedCloneId,
            sourceGenerationId,
            pitchShift: pitchShift !== 0 ? pitchShift : undefined,
          },
        })
      }

      // Custom RVC tab
      const { startVoiceConversionFn } = await import('@/server/voice.fn')

      if (!rvcModelUrl) {
        throw new Error('Please enter an RVC model URL')
      }
      return startVoiceConversionFn({
        data: {
          provider: 'rvc-v2',
          sourceGenerationId,
          rvcModelUrl,
          rvcModelName: rvcModelName || undefined,
          pitchShift: pitchShift !== 0 ? pitchShift : undefined,
        },
      })
    },
    onSuccess: () => {
      toast.success('Voice conversion started!')
      queryClient.invalidateQueries({ queryKey: ['voice-conversions'] })
      onOpenChange(false)
      // Reset form
      setSelectedCloneId(null)
      setRvcModelUrl('')
      setRvcModelName('')
      setPitchShift(0)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start conversion')
    },
  })

  const handleSubmit = () => {
    startConversionMutation.mutate()
  }

  const isValid =
    activeTab === 'my-voices' ? !!selectedCloneId : !!rvcModelUrl.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Convert Voice
          </DialogTitle>
          <DialogDescription>
            Change the singing voice in &quot;{sourceTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'custom' | 'my-voices')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-voices">
              <Mic className="h-3.5 w-3.5 mr-1" />
              My Voices
            </TabsTrigger>
            <TabsTrigger value="custom">Custom RVC</TabsTrigger>
          </TabsList>

          <TabsContent value="my-voices" className="mt-4">
            {isLoadingClones ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : readyClones && readyClones.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {readyClones.map((clone) => (
                  <button
                    key={clone.id}
                    type="button"
                    onClick={() => setSelectedCloneId(clone.id)}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all',
                      selectedCloneId === clone.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    )}
                  >
                    <div
                      className={cn(
                        'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                        selectedCloneId === clone.id
                          ? 'bg-primary/20'
                          : 'bg-muted',
                      )}
                    >
                      <Mic className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {clone.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20"
                        >
                          Singing Ready
                        </Badge>
                        {clone.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {clone.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">No trained voices yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                  Go to Voice Studio to clone a voice and train it for singing
                  before you can use it here.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rvc-model-url">RVC Model URL</Label>
                <Input
                  id="rvc-model-url"
                  placeholder="https://huggingface.co/..."
                  value={rvcModelUrl}
                  onChange={(e) => setRvcModelUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a HuggingFace URL to a .zip file containing an RVC v2
                  model
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rvc-model-name">Model Name (optional)</Label>
                <Input
                  id="rvc-model-name"
                  placeholder="My Custom Voice"
                  value={rvcModelName}
                  onChange={(e) => setRvcModelName(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Pitch Shift */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label>Pitch Shift</Label>
            <span className="text-sm text-muted-foreground tabular-nums">
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
          />
          <p className="text-xs text-muted-foreground">
            Adjust the pitch of the converted voice. Positive values raise the
            pitch, negative values lower it.
          </p>
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
            onClick={handleSubmit}
            disabled={!isValid || startConversionMutation.isPending}
          >
            {startConversionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Convert Voice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
