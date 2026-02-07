import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Globe,
  Key,
  Loader2,
  Mic,
  Music2,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  VoiceCloneCard,
  VoiceCloneCardSkeleton,
} from '@/components/voice-clone-card'
import { LazyWaveformPlayer } from '@/components/waveform-player'
import { AudioRecorder } from '@/components/audio-recorder'
import { ConvertWithCloneDialog } from '@/components/convert-with-clone-dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/voice')({
  component: VoicePage,
})

type VoiceCloneProvider = 'minimax' | 'qwen'

function VoicePage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'clones' | 'conversions'>('clones')

  // Clone form state
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDescription, setCloneDescription] = useState('')
  const [cloneProvider, setCloneProvider] =
    useState<VoiceCloneProvider>('minimax')
  const [cloneAudioUrl, setCloneAudioUrl] = useState('')
  const [cloneReferenceText, setCloneReferenceText] = useState('')

  // Audio source mode: 'url' for pasting a URL, 'record' for microphone recording
  const [audioSourceMode, setAudioSourceMode] = useState<'url' | 'record'>(
    'url',
  )
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedRecordingUrl, setUploadedRecordingUrl] = useState<
    string | null
  >(null)

  // Processing clones that need polling
  const [processingCloneIds, setProcessingCloneIds] = useState<Set<string>>(
    new Set(),
  )

  // Processing conversions that need polling
  const [processingConversionIds, setProcessingConversionIds] = useState<
    Set<string>
  >(new Set())

  // RVC training state
  const [rvcTrainingCloneIds, setRvcTrainingCloneIds] = useState<Set<string>>(
    new Set(),
  )

  // Convert Track dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [convertDialogCloneId, setConvertDialogCloneId] = useState('')
  const [convertDialogCloneName, setConvertDialogCloneName] = useState('')

  // Fetch API key status
  const { data: apiKeyStatuses } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { getAllApiKeyStatusesFn } = await import('@/server/byok.fn')
      return getAllApiKeyStatusesFn()
    },
  })

  const hasFalKey = apiKeyStatuses?.find((s) => s.provider === 'fal')?.hasKey
  const hasReplicateKey = apiKeyStatuses?.find(
    (s) => s.provider === 'replicate',
  )?.hasKey

  // Fetch voice clones
  const {
    data: voiceClones,
    isLoading: isLoadingClones,
    refetch: refetchClones,
  } = useQuery({
    queryKey: ['voice-clones'],
    queryFn: async () => {
      const { listVoiceClonesFn } = await import('@/server/voice.fn')
      return listVoiceClonesFn()
    },
  })

  // Fetch voice conversions
  const {
    data: voiceConversions,
    isLoading: isLoadingConversions,
    refetch: refetchConversions,
  } = useQuery({
    queryKey: ['voice-conversions'],
    queryFn: async () => {
      const { listVoiceConversionsFn } = await import('@/server/voice.fn')
      return listVoiceConversionsFn()
    },
  })

  // Create voice clone mutation
  const createCloneMutation = useMutation({
    mutationFn: async () => {
      const { createVoiceCloneFn } = await import('@/server/voice.fn')
      return createVoiceCloneFn({
        data: {
          name: cloneName,
          description: cloneDescription || undefined,
          provider: cloneProvider,
          audioUrl: effectiveAudioUrl,
          referenceText:
            cloneProvider === 'qwen' ? cloneReferenceText : undefined,
        },
      })
    },
    onSuccess: (result) => {
      toast.success('Voice cloning started!')
      setIsCloneDialogOpen(false)
      resetCloneForm()
      refetchClones()
      // Add to processing list for polling
      setProcessingCloneIds((prev) => new Set(prev).add(result.id))
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start voice cloning')
    },
  })

  // Delete voice clone mutation
  const deleteCloneMutation = useMutation({
    mutationFn: async (cloneId: string) => {
      const { deleteVoiceCloneFn } = await import('@/server/voice.fn')
      return deleteVoiceCloneFn({ data: { cloneId } })
    },
    onSuccess: () => {
      toast.success('Voice clone deleted')
      refetchClones()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete voice clone')
    },
  })

  // Delete voice conversion mutation
  const deleteConversionMutation = useMutation({
    mutationFn: async (conversionId: string) => {
      const { deleteVoiceConversionFn } = await import('@/server/voice.fn')
      return deleteVoiceConversionFn({ data: { conversionId } })
    },
    onSuccess: () => {
      toast.success('Conversion deleted')
      refetchConversions()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete conversion')
    },
  })

  // Train RVC model mutation
  const trainRvcMutation = useMutation({
    mutationFn: async (voiceCloneId: string) => {
      const { trainRvcModelFn } = await import('@/server/voice.fn')
      return trainRvcModelFn({ data: { voiceCloneId } })
    },
    onSuccess: (result) => {
      toast.success('RVC training started! This takes about 13 minutes.')
      refetchClones()
      setRvcTrainingCloneIds((prev) => new Set(prev).add(result.id))
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start RVC training')
    },
  })

  // Handle Train for Singing action
  const handleTrainRvc = useCallback(
    (voiceCloneId: string) => {
      trainRvcMutation.mutate(voiceCloneId)
    },
    [trainRvcMutation],
  )

  // Handle Convert Track action — open the dialog
  const handleConvertTrack = useCallback(
    (voiceCloneId: string) => {
      const clone = voiceClones?.find((c) => c.id === voiceCloneId)
      if (!clone) return
      setConvertDialogCloneId(voiceCloneId)
      setConvertDialogCloneName(clone.name)
      setConvertDialogOpen(true)
    },
    [voiceClones],
  )

  const resetCloneForm = () => {
    setCloneName('')
    setCloneDescription('')
    setCloneProvider('minimax')
    setCloneAudioUrl('')
    setCloneReferenceText('')
    setAudioSourceMode('url')
    setIsUploading(false)
    setUploadedRecordingUrl(null)
  }

  // Handle recording completion: upload the audio blob to get a URL
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsUploading(true)
    setUploadedRecordingUrl(null)

    try {
      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      )

      const { uploadRecordedAudioFn } = await import('@/server/voice.fn')
      const result = await uploadRecordedAudioFn({
        data: {
          audioBase64: base64,
          filename: `recording-${Date.now()}.webm`,
          contentType: blob.type || 'audio/webm',
        },
      })

      setUploadedRecordingUrl(result.url)
      setCloneAudioUrl(result.url)
      toast.success(
        `Recording uploaded to ${result.storage === 'bunny' ? 'Bunny CDN' : 'fal.ai storage'}`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to upload recording',
      )
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Handle recording discard
  const handleRecordingDiscard = useCallback(() => {
    setUploadedRecordingUrl(null)
    // Only clear the audio URL if it was set from a recording
    if (audioSourceMode === 'record') {
      setCloneAudioUrl('')
    }
  }, [audioSourceMode])

  // Poll processing clones
  useEffect(() => {
    if (processingCloneIds.size === 0) return

    const pollInterval = setInterval(async () => {
      const { checkVoiceCloneStatusFn } = await import('@/server/voice.fn')

      for (const cloneId of processingCloneIds) {
        try {
          const result = await checkVoiceCloneStatusFn({
            data: { cloneId },
          })

          if (result.status === 'ready' || result.status === 'failed') {
            setProcessingCloneIds((prev) => {
              const next = new Set(prev)
              next.delete(cloneId)
              return next
            })
            refetchClones()

            if (result.status === 'ready') {
              toast.success('Voice clone is ready!')
            } else {
              toast.error(`Voice cloning failed: ${result.error}`)
            }
          }
        } catch (err) {
          console.error('Error polling clone status:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [processingCloneIds, refetchClones])

  // Poll processing conversions
  useEffect(() => {
    if (processingConversionIds.size === 0) return

    const pollInterval = setInterval(async () => {
      const { checkVoiceConversionStatusFn } = await import('@/server/voice.fn')

      for (const conversionId of processingConversionIds) {
        try {
          const result = await checkVoiceConversionStatusFn({
            data: { conversionId },
          })

          if (result.status === 'completed' || result.status === 'failed') {
            setProcessingConversionIds((prev) => {
              const next = new Set(prev)
              next.delete(conversionId)
              return next
            })
            refetchConversions()

            if (result.status === 'completed') {
              toast.success('Voice conversion complete!')
            } else {
              toast.error(`Conversion failed: ${result.error}`)
            }
          }
        } catch (err) {
          console.error('Error polling conversion status:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [processingConversionIds, refetchConversions])

  // Track processing conversions
  useEffect(() => {
    if (!voiceConversions) return

    const processing = voiceConversions
      .filter((c) => c.status === 'processing')
      .map((c) => c.id)

    if (processing.length > 0) {
      setProcessingConversionIds((prev) => {
        const next = new Set(prev)
        processing.forEach((id) => next.add(id))
        return next
      })
    }
  }, [voiceConversions])

  // Track processing clones
  useEffect(() => {
    if (!voiceClones) return

    const processing = voiceClones
      .filter((c) => c.status === 'processing')
      .map((c) => c.id)

    if (processing.length > 0) {
      setProcessingCloneIds((prev) => {
        const next = new Set(prev)
        processing.forEach((id) => next.add(id))
        return next
      })
    }
  }, [voiceClones])

  // Track RVC training clones
  useEffect(() => {
    if (!voiceClones) return

    const training = voiceClones
      .filter((c) => c.rvcModelStatus === 'training')
      .map((c) => c.id)

    if (training.length > 0) {
      setRvcTrainingCloneIds((prev) => {
        const next = new Set(prev)
        training.forEach((id) => next.add(id))
        return next
      })
    }
  }, [voiceClones])

  // Poll RVC training status
  useEffect(() => {
    if (rvcTrainingCloneIds.size === 0) return

    const pollInterval = setInterval(async () => {
      const { checkRvcTrainingStatusFn } = await import('@/server/voice.fn')

      for (const cloneId of rvcTrainingCloneIds) {
        try {
          const result = await checkRvcTrainingStatusFn({
            data: { voiceCloneId: cloneId },
          })

          if (
            result.rvcModelStatus === 'ready' ||
            result.rvcModelStatus === 'failed'
          ) {
            setRvcTrainingCloneIds((prev) => {
              const next = new Set(prev)
              next.delete(cloneId)
              return next
            })
            refetchClones()

            if (result.rvcModelStatus === 'ready') {
              toast.success(
                'Singing voice model is ready! You can now convert tracks.',
              )
            } else {
              toast.error(`RVC training failed: ${result.rvcError}`)
            }
          }
        } catch (err) {
          console.error('Error polling RVC training status:', err)
        }
      }
    }, 5000) // Poll every 5 seconds (training takes ~13 minutes)

    return () => clearInterval(pollInterval)
  }, [rvcTrainingCloneIds, refetchClones])

  // Determine the effective audio URL based on the selected source mode
  const effectiveAudioUrl =
    audioSourceMode === 'record' ? uploadedRecordingUrl || '' : cloneAudioUrl

  const canCreateClone =
    hasFalKey && cloneName.trim() && effectiveAudioUrl.trim() && !isUploading

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mic className="h-8 w-8" />
            Voice Studio
          </h1>
          <p className="text-muted-foreground">
            Clone voices and convert vocals in your tracks
          </p>
        </div>

        {/* Create Clone Button */}
        <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasFalKey}>
              <Plus className="mr-2 h-4 w-4" />
              Clone Voice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Voice Clone</DialogTitle>
              <DialogDescription>
                Upload an audio sample to clone a voice. Audio should be at
                least 10 seconds long.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clone-name">Name</Label>
                <Input
                  id="clone-name"
                  placeholder="My Voice Clone"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clone-description">
                  Description (optional)
                </Label>
                <Textarea
                  id="clone-description"
                  placeholder="A description of this voice..."
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clone-provider">Provider</Label>
                <Select
                  value={cloneProvider}
                  onValueChange={(v) =>
                    setCloneProvider(v as VoiceCloneProvider)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimax">
                      MiniMax - Returns voice ID for TTS
                    </SelectItem>
                    <SelectItem value="qwen">
                      Qwen 3 - Returns speaker embedding
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audio Source</Label>
                {/* Audio source mode tabs */}
                <div className="flex rounded-lg border bg-muted p-1 gap-1">
                  <button
                    type="button"
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      audioSourceMode === 'url'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setAudioSourceMode('url')}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Paste URL
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      audioSourceMode === 'record'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setAudioSourceMode('record')}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Record Microphone
                  </button>
                </div>

                {/* Paste URL mode */}
                {audioSourceMode === 'url' && (
                  <div className="space-y-1.5">
                    <Input
                      id="clone-audio"
                      placeholder="https://example.com/voice-sample.mp3"
                      value={cloneAudioUrl}
                      onChange={(e) => setCloneAudioUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Direct URL to an audio file (MP3, WAV, etc.)
                    </p>
                  </div>
                )}

                {/* Record Microphone mode */}
                {audioSourceMode === 'record' && (
                  <div className="space-y-2">
                    <AudioRecorder
                      onRecordingComplete={handleRecordingComplete}
                      onRecordingDiscard={handleRecordingDiscard}
                      disabled={isUploading || createCloneMutation.isPending}
                      minDuration={10}
                      maxDuration={120}
                    />
                    {/* Upload status */}
                    {isUploading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading recording...
                      </div>
                    )}
                    {uploadedRecordingUrl && !isUploading && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Recording uploaded and ready
                      </div>
                    )}
                  </div>
                )}
              </div>

              {cloneProvider === 'qwen' && (
                <div className="space-y-2">
                  <Label htmlFor="clone-reference">
                    Reference Text (optional)
                  </Label>
                  <Textarea
                    id="clone-reference"
                    placeholder="The text that was spoken in the audio sample..."
                    value={cloneReferenceText}
                    onChange={(e) => setCloneReferenceText(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Providing the transcript can improve cloning quality
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCloneDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createCloneMutation.mutate()}
                disabled={!canCreateClone || createCloneMutation.isPending}
              >
                {createCloneMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Clone Voice
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Key Warning */}
      {!hasFalKey && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  fal.ai API key required for voice cloning
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Add your fal.ai API key in{' '}
                  <Link to="/settings" className="underline font-medium">
                    Settings
                  </Link>{' '}
                  to clone voices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasReplicateKey && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Replicate API key required for voice conversion
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Add your Replicate API key in{' '}
                  <Link to="/settings" className="underline font-medium">
                    Settings
                  </Link>{' '}
                  to convert voices in your tracks.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'clones' | 'conversions')}
      >
        <TabsList>
          <TabsTrigger value="clones" className="gap-2">
            <Mic className="h-4 w-4" />
            My Voices
            {voiceClones && voiceClones.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {voiceClones.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="conversions" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Conversions
            {voiceConversions && voiceConversions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {voiceConversions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Voice Clones Tab */}
        <TabsContent value="clones" className="mt-6">
          {isLoadingClones ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <VoiceCloneCardSkeleton key={i} />
              ))}
            </div>
          ) : voiceClones && voiceClones.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {voiceClones.map((clone) => (
                <VoiceCloneCard
                  key={clone.id}
                  voiceClone={clone}
                  onDelete={(id) => deleteCloneMutation.mutate(id)}
                  onTrainRvc={hasReplicateKey ? handleTrainRvc : undefined}
                  onConvertTrack={
                    hasReplicateKey ? handleConvertTrack : undefined
                  }
                  isDeleting={deleteCloneMutation.isPending}
                  isTraining={trainRvcMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mic className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">No voice clones yet</h3>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                  Clone a voice from an audio sample to use for text-to-speech
                  or as a reference for voice conversion.
                </p>
                {hasFalKey && (
                  <Button
                    className="mt-4"
                    onClick={() => setIsCloneDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Clone Your First Voice
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions" className="mt-6">
          {isLoadingConversions ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-muted rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : voiceConversions && voiceConversions.length > 0 ? (
            <div className="space-y-4">
              {voiceConversions.map((conversion) => (
                <ConversionCard
                  key={conversion.id}
                  conversion={conversion}
                  onDelete={(id) => deleteConversionMutation.mutate(id)}
                  isDeleting={deleteConversionMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wand2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">No conversions yet</h3>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                  Convert the singing voice in your generated tracks. Go to a
                  completed track and click &quot;Convert Voice&quot;.
                </p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link to="/music">Go to Music</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Convert Track with Clone Dialog */}
      <ConvertWithCloneDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        voiceCloneId={convertDialogCloneId}
        voiceCloneName={convertDialogCloneName}
      />
    </div>
  )
}

// ============================================================================
// Conversion Card Component
// ============================================================================

interface ConversionCardProps {
  conversion: {
    id: string
    title: string | null
    provider: string
    targetSinger: string | null
    rvcModelName: string | null
    status: string
    outputAudioUrl: string | null
    outputAudioStored: boolean
    error: string | null
    progress: number
    createdAt: Date
    sourceGeneration: {
      id: string
      title: string | null
      prompt: string
    } | null
  }
  onDelete: (id: string) => void
  isDeleting?: boolean
}

function ConversionCard({
  conversion,
  onDelete,
  isDeleting = false,
}: ConversionCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const displayTitle = conversion.title || 'Voice Conversion'
  const targetVoice =
    conversion.targetSinger || conversion.rvcModelName || 'Custom Voice'
  const isCompleted =
    conversion.status === 'completed' && conversion.outputAudioUrl
  const isFailed = conversion.status === 'failed'
  const isProcessing = conversion.status === 'processing'

  const handleDelete = () => {
    onDelete(conversion.id)
    setIsDeleteDialogOpen(false)
  }

  return (
    <>
      <div className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-[var(--shadow-md)] transition-all duration-300">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden',
              isCompleted
                ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent'
                : isFailed
                  ? 'bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent'
                  : 'bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent',
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            ) : isFailed ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Music2 className="h-5 w-5 text-primary/40" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-tight truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {conversion.provider === 'amphion-svc'
                  ? 'Amphion SVC'
                  : 'RVC v2'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {targetVoice}
              </span>
              {conversion.outputAudioStored && (
                <Cloud className="h-3 w-3 text-emerald-500" />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Audio Player */}
        {isCompleted && (
          <LazyWaveformPlayer
            src={conversion.outputAudioUrl!}
            height={40}
            compact
            threshold={0.1}
          />
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="flex items-center gap-3">
            <div className="relative h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary/50 rounded-full transition-all"
                style={{ width: `${conversion.progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {conversion.progress}%
            </span>
          </div>
        )}

        {/* Error */}
        {isFailed && conversion.error && (
          <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
            {conversion.error}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this voice conversion? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
