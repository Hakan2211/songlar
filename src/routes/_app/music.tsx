import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Heart,
  Key,
  ListMusic,
  Loader2,
  Lock,
  Mic,
  Music,
  Music2,
  Settings2,
  Sparkles,
  Timer,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Track } from '@/components/track-card'
import { VoiceConversionDialog } from '@/components/voice-conversion-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { TrackCard, TrackCardSkeleton } from '@/components/track-card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/music')({
  component: MusicPage,
})

type MusicProvider = 'elevenlabs' | 'minimax-v2' | 'minimax-v2.5'

interface Generation extends Track {
  progress: number
  error: string | null
}

// Model configuration for dropdown
const MODELS: Record<
  MusicProvider,
  { name: string; description: string; icon: typeof Music2; apiKey: string }
> = {
  'minimax-v2': {
    name: 'MiniMax v2',
    description: 'Style + Lyrics via fal.ai',
    icon: Music2,
    apiKey: 'fal.ai',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Text to Music',
    icon: Wand2,
    apiKey: 'fal.ai',
  },
  'minimax-v2.5': {
    name: 'MiniMax v2.5',
    description: 'Direct API, Latest model',
    icon: Sparkles,
    apiKey: 'MiniMax',
  },
}

function MusicPage() {
  const queryClient = useQueryClient()
  const trackListRef = useRef<HTMLDivElement>(null)

  // Form state
  const [provider, setProvider] = useState<MusicProvider>('minimax-v2')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [forceInstrumental, setForceInstrumental] = useState(false)

  // Audio quality settings (MiniMax only)
  type SampleRateOption = '16000' | '24000' | '32000' | '44100'
  type BitrateOption = '32000' | '64000' | '128000' | '256000'
  type FormatOption = 'mp3' | 'wav' | 'pcm' | 'flac'

  const [sampleRate, setSampleRate] = useState<SampleRateOption>('44100')
  const [bitrate, setBitrate] = useState<BitrateOption>('256000')
  const [audioFormat, setAudioFormat] = useState<FormatOption>('mp3')
  const [showAudioSettings, setShowAudioSettings] = useState(false)

  // Mobile drawer state
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Filter state
  const [filterTab, setFilterTab] = useState<'all' | 'favorites'>('all')

  // Track action states
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(
    null,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // Voice conversion dialog state
  const [voiceConversionOpen, setVoiceConversionOpen] = useState(false)
  const [voiceConversionTrackId, setVoiceConversionTrackId] = useState<
    string | null
  >(null)
  const [voiceConversionTrackTitle, setVoiceConversionTrackTitle] = useState('')

  // Fetch active voice conversions
  const { data: voiceConversions, refetch: refetchConversions } = useQuery({
    queryKey: ['voice-conversions'],
    queryFn: async () => {
      const { listVoiceConversionsFn } = await import('@/server/voice.fn')
      return listVoiceConversionsFn()
    },
  })

  const activeConversions = voiceConversions?.filter(
    (c) => c.status === 'processing',
  )
  const hasActiveConversions = activeConversions && activeConversions.length > 0

  // Poll active conversions
  useEffect(() => {
    if (!hasActiveConversions) return

    const pollConversions = async () => {
      const { checkVoiceConversionStatusFn } = await import('@/server/voice.fn')

      for (const conv of activeConversions) {
        try {
          const result = await checkVoiceConversionStatusFn({
            data: { conversionId: conv.id },
          })

          if (result.status === 'completed' || result.status === 'failed') {
            refetchConversions()
            if (result.status === 'completed') {
              toast.success(
                `Voice conversion "${conv.title || 'Untitled'}" complete!`,
              )
            } else if (result.error) {
              toast.error(`Conversion failed: ${result.error}`)
            }
          }
        } catch (error) {
          console.error('Error polling conversion status:', error)
        }
      }
    }

    const interval = setInterval(pollConversions, 3000)
    return () => clearInterval(interval)
  }, [hasActiveConversions, activeConversions, refetchConversions])

  // Fetch API key status
  const { data: apiKeyStatuses } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { getAllApiKeyStatusesFn } = await import('@/server/byok.fn')
      return getAllApiKeyStatusesFn()
    },
  })

  // Fetch Bunny status
  const { data: bunnyStatus } = useQuery({
    queryKey: ['bunny-status'],
    queryFn: async () => {
      const { getBunnyStatusFn } = await import('@/server/byok.fn')
      return getBunnyStatusFn()
    },
  })

  // Check for Replicate API key
  const hasReplicateKey =
    apiKeyStatuses?.find((s) => s.provider === 'replicate')?.hasKey ?? false

  // Handle voice conversion
  const handleConvertVoice = useCallback(
    (trackId: string, trackTitle: string) => {
      setVoiceConversionTrackId(trackId)
      setVoiceConversionTrackTitle(trackTitle)
      setVoiceConversionOpen(true)
    },
    [],
  )

  // Check platform access (payment gate)
  const { data: platformAccess } = useQuery({
    queryKey: ['platform-access'],
    queryFn: async () => {
      const { checkPlatformAccessFn } = await import('@/server/music.fn')
      return checkPlatformAccessFn()
    },
  })

  const hasPlatformAccess = platformAccess?.hasAccess ?? false

  const hasFalKey = apiKeyStatuses?.find((s) => s.provider === 'fal')?.hasKey
  const hasMiniMaxKey = apiKeyStatuses?.find(
    (s) => s.provider === 'minimax',
  )?.hasKey
  const hasBunnySettings = bunnyStatus?.hasKey || false

  // Check if user has the required key for the selected provider
  const hasRequiredKey = () => {
    if (provider === 'minimax-v2.5') return hasMiniMaxKey
    return hasFalKey
  }

  // Fetch active generations
  const { data: activeGenerations } = useQuery({
    queryKey: ['active-generations'],
    queryFn: async () => {
      const { getActiveGenerationsFn } = await import('@/server/music.fn')
      const result = await getActiveGenerationsFn()
      return result as unknown as Array<Generation>
    },
  })

  // Fetch generations with filter
  const { data: generationsData, isLoading: loadingGenerations } = useQuery({
    queryKey: ['generations', filterTab],
    queryFn: async () => {
      const { listGenerationsFn } = await import('@/server/music.fn')
      const result = await listGenerationsFn({
        data: {
          limit: 100,
          favoritesOnly: filterTab === 'favorites',
        },
      })
      return result as { generations: Array<Generation>; total: number }
    },
  })

  const generations = generationsData?.generations
  const totalTracks = generationsData?.total || 0

  // Poll for status updates on active generations
  useEffect(() => {
    if (!activeGenerations?.length) return

    const pollStatuses = async () => {
      const { checkGenerationStatusFn } = await import('@/server/music.fn')

      for (const gen of activeGenerations) {
        try {
          const status = await checkGenerationStatusFn({
            data: { generationId: gen.id },
          })

          if (status.status === 'completed' || status.status === 'failed') {
            queryClient.invalidateQueries({ queryKey: ['active-generations'] })
            queryClient.invalidateQueries({ queryKey: ['generations'] })

            if (status.status === 'completed') {
              toast.success('Music generation completed!')
            } else if (status.error) {
              toast.error(`Generation failed: ${status.error}`)
            }
          }
        } catch (error) {
          console.error('Error polling status:', error)
        }
      }
    }

    const interval = setInterval(pollStatuses, 3000)
    return () => clearInterval(interval)
  }, [activeGenerations, queryClient])

  // Virtual list setup - estimateSize includes card height + bottom padding for spacing
  const virtualizer = useVirtualizer({
    count: generations?.length || 0,
    getScrollElement: () => trackListRef.current,
    estimateSize: () => 112, // ~100px card + 12px bottom spacing
    overscan: 5,
  })

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { generateMusicFn } = await import('@/server/music.fn')

      const data: {
        provider: MusicProvider
        prompt?: string
        lyrics?: string
        durationMs?: number
        forceInstrumental?: boolean
        audioSettings?: {
          sampleRate?: '16000' | '24000' | '32000' | '44100'
          bitrate?: '32000' | '64000' | '128000' | '256000'
          format?: 'mp3' | 'wav' | 'pcm' | 'flac'
        }
      } = { provider }

      switch (provider) {
        case 'elevenlabs':
          data.prompt = prompt
          if (durationMs !== null) data.durationMs = durationMs
          if (forceInstrumental) data.forceInstrumental = true
          break
        case 'minimax-v2':
          data.prompt = prompt
          data.lyrics = lyrics
          data.audioSettings = { sampleRate, bitrate, format: audioFormat }
          break
        case 'minimax-v2.5':
          data.lyrics = lyrics
          if (prompt.trim()) data.prompt = prompt
          data.audioSettings = { sampleRate, bitrate, format: audioFormat }
          break
      }

      return generateMusicFn({ data })
    },
    onSuccess: (result) => {
      if (result.status === 'failed') {
        toast.error(result.error || 'Generation failed')
      } else {
        toast.success('Generation started!')
        setPrompt('')
        setLyrics('')
        setDurationMs(null)
        setForceInstrumental(false)
        setSampleRate('44100')
        setBitrate('256000')
        setAudioFormat('mp3')
        // Close mobile drawer on success
        setIsFormOpen(false)
      }
      queryClient.invalidateQueries({ queryKey: ['active-generations'] })
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation')
    },
  })

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (trackId: string) => {
      setTogglingFavoriteId(trackId)
      const { toggleFavoriteFn } = await import('@/server/music.fn')
      return toggleFavoriteFn({ data: { generationId: trackId } })
    },
    onSuccess: (result) => {
      toast.success(
        result.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      )
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update favorite')
    },
    onSettled: () => {
      setTogglingFavoriteId(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (trackId: string) => {
      setDeletingId(trackId)
      const { deleteGenerationFn } = await import('@/server/music.fn')
      return deleteGenerationFn({ data: { generationId: trackId } })
    },
    onSuccess: () => {
      toast.success('Track deleted')
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete track')
    },
    onSettled: () => {
      setDeletingId(null)
    },
  })

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({
      trackId,
      title,
    }: {
      trackId: string
      title: string
    }) => {
      setRenamingId(trackId)
      const { updateGenerationTitleFn } = await import('@/server/music.fn')
      return updateGenerationTitleFn({ data: { generationId: trackId, title } })
    },
    onSuccess: () => {
      toast.success('Track renamed')
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rename track')
    },
    onSettled: () => {
      setRenamingId(null)
    },
  })

  // Upload to CDN mutation
  const uploadToCdnMutation = useMutation({
    mutationFn: async (trackId: string) => {
      setUploadingId(trackId)
      const { uploadToCdnFn } = await import('@/server/music.fn')
      return uploadToCdnFn({ data: { generationId: trackId } })
    },
    onSuccess: () => {
      toast.success('Uploaded to CDN')
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload to CDN')
    },
    onSettled: () => {
      setUploadingId(null)
    },
  })

  // Download handler
  const handleDownload = useCallback((track: Track) => {
    if (!track.audioUrl) return
    const link = document.createElement('a')
    link.href = track.audioUrl
    link.download = `${track.title || 'track'}.mp3`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const handleGenerate = () => {
    switch (provider) {
      case 'elevenlabs':
        if (!prompt.trim()) {
          toast.error('Please enter a music description')
          return
        }
        if (prompt.length < 10) {
          toast.error('Description must be at least 10 characters')
          return
        }
        if (prompt.length > 300) {
          toast.error('Description must be 300 characters or less')
          return
        }
        break
      case 'minimax-v2':
        if (!prompt.trim()) {
          toast.error('Please enter a style prompt')
          return
        }
        if (prompt.length < 10) {
          toast.error('Style prompt must be at least 10 characters')
          return
        }
        if (prompt.length > 300) {
          toast.error('Style prompt must be 300 characters or less')
          return
        }
        if (!lyrics.trim()) {
          toast.error('Please enter lyrics')
          return
        }
        if (lyrics.length < 10) {
          toast.error('Lyrics must be at least 10 characters')
          return
        }
        if (lyrics.length > 3000) {
          toast.error('Lyrics must be 3000 characters or less')
          return
        }
        break
      case 'minimax-v2.5':
        if (!lyrics.trim()) {
          toast.error('Please enter lyrics')
          return
        }
        if (lyrics.length > 3500) {
          toast.error('Lyrics must be 3500 characters or less')
          return
        }
        if (prompt.length > 2000) {
          toast.error('Style prompt must be 2000 characters or less')
          return
        }
        break
    }
    generateMutation.mutate()
  }

  const isGenerating = generateMutation.isPending
  const hasActiveGenerations = activeGenerations && activeGenerations.length > 0
  const needsLyrics = provider === 'minimax-v2' || provider === 'minimax-v2.5'
  const needsPrompt = provider === 'elevenlabs' || provider === 'minimax-v2'

  const getPromptLimit = () => {
    if (provider === 'elevenlabs' || provider === 'minimax-v2') return 300
    return 2000
  }

  const getLyricsLimit = () => {
    if (provider === 'minimax-v2') return 3000
    return 3500
  }

  const getPromptPlaceholder = () => {
    if (provider === 'elevenlabs') {
      return 'Upbeat electronic dance track with energetic synths and driving bass...'
    }
    if (provider === 'minimax-v2') {
      return 'Upbeat pop song with acoustic guitar and soft vocals...'
    }
    return 'Optional: Soft acoustic ballad with piano... (leave empty to auto-detect from lyrics)'
  }

  const currentModel = MODELS[provider]
  const CurrentModelIcon = currentModel.icon

  // Form content component - used in both desktop dock and mobile drawer
  const FormContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn('space-y-4', isMobile && 'pb-6')}>
      {/* Row 1: Model Select + Prompt */}
      <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start')}>
        {/* Model Dropdown */}
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as MusicProvider)}
          disabled={!hasPlatformAccess}
        >
          <SelectTrigger
            className={cn(
              'h-auto py-2.5',
              isMobile ? 'w-full' : 'w-[200px] shrink-0',
            )}
          >
            <SelectValue>
              <div className="flex items-center gap-2">
                <CurrentModelIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">{currentModel.name}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(MODELS) as Array<
                [MusicProvider, (typeof MODELS)[MusicProvider]]
              >
            ).map(([key, model]) => {
              const Icon = model.icon
              return (
                <SelectItem key={key} value={key} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.description}
                      </span>
                    </div>
                    <div className="ml-auto pl-4 flex items-center">
                      <Key className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {model.apiKey}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Prompt/Style Input */}
        <div className="flex-1 space-y-1">
          <Textarea
            placeholder={getPromptPlaceholder()}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            disabled={isGenerating || !hasPlatformAccess}
            className="resize-none min-h-[72px]"
          />
          {needsPrompt && (
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {prompt.length}/{getPromptLimit()}
            </p>
          )}
        </div>
      </div>

      {/* ElevenLabs: Duration + Instrumental Controls */}
      {provider === 'elevenlabs' && (
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm">
                <Timer className="h-3.5 w-3.5" />
                Duration
              </Label>
              <span className="text-xs font-medium tabular-nums">
                {durationMs === null
                  ? 'Auto'
                  : `${Math.round(durationMs / 1000)}s`}
              </span>
            </div>
            <Slider
              min={0}
              max={600}
              step={5}
              value={[durationMs === null ? 0 : Math.round(durationMs / 1000)]}
              onValueChange={([val]) =>
                setDurationMs(val === 0 ? null : val * 1000)
              }
              disabled={isGenerating || !hasPlatformAccess}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Mic className="h-3.5 w-3.5" />
              Instrumental Only
            </Label>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={forceInstrumental}
                onCheckedChange={setForceInstrumental}
                disabled={isGenerating || !hasPlatformAccess}
              />
              <span className="text-xs text-muted-foreground">
                {forceInstrumental ? 'No vocals' : 'With vocals'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Field (MiniMax only) - Always visible */}
      {needsLyrics && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Lyrics</Label>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {lyrics.length}/{getLyricsLimit()}
            </span>
          </div>
          <Textarea
            placeholder={`[Verse]
Walking down the street tonight
Stars are shining oh so bright

[Chorus]
This is where we belong
Singing our favorite song`}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            disabled={isGenerating || !hasPlatformAccess}
            className="resize-none font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Use [Verse], [Chorus], [Bridge], [Intro], [Outro] tags
          </p>
        </div>
      )}

      {/* Audio Settings (MiniMax only) */}
      {needsLyrics && (
        <Collapsible
          open={showAudioSettings}
          onOpenChange={setShowAudioSettings}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isGenerating || !hasPlatformAccess}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Audio Quality Settings
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  showAudioSettings && 'rotate-180',
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Sample Rate
                </Label>
                <Select
                  value={sampleRate}
                  onValueChange={(v) => setSampleRate(v as SampleRateOption)}
                  disabled={isGenerating || !hasPlatformAccess}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16000">16 kHz</SelectItem>
                    <SelectItem value="24000">24 kHz</SelectItem>
                    <SelectItem value="32000">32 kHz</SelectItem>
                    <SelectItem value="44100">44.1 kHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bitrate</Label>
                <Select
                  value={bitrate}
                  onValueChange={(v) => setBitrate(v as BitrateOption)}
                  disabled={isGenerating || !hasPlatformAccess}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="32000">32 kbps</SelectItem>
                    <SelectItem value="64000">64 kbps</SelectItem>
                    <SelectItem value="128000">128 kbps</SelectItem>
                    <SelectItem value="256000">256 kbps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Format</Label>
                <Select
                  value={audioFormat}
                  onValueChange={(v) => setAudioFormat(v as FormatOption)}
                  disabled={isGenerating || !hasPlatformAccess}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp3">MP3</SelectItem>
                    <SelectItem value="wav">WAV</SelectItem>
                    <SelectItem value="pcm">PCM</SelectItem>
                    {provider === 'minimax-v2' && (
                      <SelectItem value="flac">FLAC</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Generate Button - Full width */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !hasRequiredKey() || !hasPlatformAccess}
        size="xl"
        className="w-full"
      >
        {!hasPlatformAccess ? (
          <>
            <Lock className="h-4 w-4" />
            Get Access to Generate
          </>
        ) : isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Music
          </>
        )}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="shrink-0 py-4 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/5">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Create Music
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate AI-powered music with your own API keys
            </p>
          </div>
        </div>
      </div>

      {/* Platform Access Warning */}
      {!hasPlatformAccess && platformAccess !== undefined && (
        <div className="shrink-0 px-1 pb-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-200 dark:border-violet-800">
            <div className="p-3 rounded-xl bg-violet-500/10">
              <Lock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-violet-900 dark:text-violet-100">
                Platform Access Required
              </p>
              <p className="text-sm text-violet-700 dark:text-violet-300">
                Purchase platform access to start generating AI music
              </p>
            </div>
            <Link to="/profile">
              <Button size="lg" className="shadow-lg">
                Get Access
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* API Key Warning */}
      {hasPlatformAccess && !hasRequiredKey() && (
        <div className="shrink-0 px-1 pb-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                API Key Required
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {provider === 'minimax-v2.5' ? 'MiniMax' : 'fal.ai'} API key
                required.{' '}
                <Link
                  to="/settings"
                  className="underline font-medium hover:no-underline"
                >
                  Add in Settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* In Progress Section - Above tracks */}
      {hasActiveGenerations && (
        <div className="shrink-0 px-1 pb-3">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Generating
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {activeGenerations.map((gen) => (
                  <div
                    key={gen.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-blue-700 dark:text-blue-300 truncate flex-1">
                      {gen.title || gen.prompt.slice(0, 40)}...
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium tabular-nums ml-3">
                      {gen.progress || 0}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Voice Conversions */}
      {hasActiveConversions && (
        <div className="shrink-0 px-1 pb-3">
          <Card className="border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-medium text-violet-900 dark:text-violet-100">
                  Voice Conversions
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {activeConversions.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-violet-700 dark:text-violet-300 truncate flex-1">
                      {conv.title || 'Voice Conversion'}
                    </span>
                    <span className="text-violet-600 dark:text-violet-400 font-medium tabular-nums ml-3">
                      {conv.progress || 0}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Track List Section - Takes remaining space */}
      <div className="flex-1 min-h-0 flex flex-col px-1">
        {/* Filter Tabs Header */}
        <div className="flex items-center justify-between mb-3">
          <Tabs
            value={filterTab}
            onValueChange={(v) => setFilterTab(v as 'all' | 'favorites')}
          >
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <ListMusic className="h-4 w-4" />
                All Tracks
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-2">
                <Heart className="h-4 w-4" />
                Favorites
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-muted-foreground tabular-nums">
            {totalTracks} {totalTracks === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {/* Scrollable Track List */}
        <div
          ref={trackListRef}
          className="flex-1 overflow-auto rounded-2xl border bg-muted/30 mb-4 md:mb-0"
        >
          {loadingGenerations ? (
            <div className="p-4 space-y-3">
              <TrackCardSkeleton />
              <TrackCardSkeleton />
              <TrackCardSkeleton />
              <TrackCardSkeleton />
            </div>
          ) : generations && generations.length > 0 ? (
            <div className="py-3">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const track = generations[virtualItem.index]
                  return (
                    <div
                      key={track.id}
                      ref={virtualizer.measureElement}
                      data-index={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      className="px-4 pb-3"
                    >
                      <TrackCard
                        track={track}
                        onToggleFavorite={(id) =>
                          toggleFavoriteMutation.mutate(id)
                        }
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onRename={(id, title) =>
                          renameMutation.mutate({ trackId: id, title })
                        }
                        onUploadToCdn={(id) => uploadToCdnMutation.mutate(id)}
                        onDownload={handleDownload}
                        onConvertVoice={handleConvertVoice}
                        isTogglingFavorite={togglingFavoriteId === track.id}
                        isDeleting={deletingId === track.id}
                        isRenaming={renamingId === track.id}
                        isUploading={uploadingId === track.id}
                        hasBunnySettings={hasBunnySettings}
                        hasReplicateKey={hasReplicateKey}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="rounded-2xl bg-muted/50 p-5 mb-5">
                <Music className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {filterTab === 'favorites'
                  ? 'No favorites yet'
                  : 'No tracks yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filterTab === 'favorites'
                  ? 'Heart your favorite tracks to see them here'
                  : 'Use the form below to create your first AI-generated track'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* DESKTOP: Sticky Bottom Form (Dock Style)    */}
      {/* ============================================ */}
      <div className="hidden md:block shrink-0 sticky bottom-0 z-10 bg-muted/80 backdrop-blur-md border-t shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)]">
        <div className="px-4 py-4">
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-4 pb-4">
              <FormContent />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================ */}
      {/* MOBILE: Drawer Trigger + Bottom Sheet       */}
      {/* ============================================ */}
      <div className="md:hidden">
        <Drawer open={isFormOpen} onOpenChange={setIsFormOpen}>
          {/* Trigger - Sticky bar at bottom */}
          <div className="sticky bottom-0 z-10 bg-muted/80 backdrop-blur-md border-t shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
            <DrawerTrigger asChild>
              <button className="w-full p-4 flex items-center justify-center gap-2 text-primary font-medium active:bg-muted/50 transition-colors">
                <Sparkles className="h-5 w-5" />
                <span>Create New Track</span>
                <ChevronUp className="h-4 w-4 ml-1" />
              </button>
            </DrawerTrigger>
          </div>

          {/* Drawer Content */}
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create New Track
              </DrawerTitle>
            </DrawerHeader>

            <div className="px-4 overflow-y-auto">
              <FormContent isMobile />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Voice Conversion Dialog */}
      {voiceConversionTrackId && (
        <VoiceConversionDialog
          open={voiceConversionOpen}
          onOpenChange={setVoiceConversionOpen}
          sourceGenerationId={voiceConversionTrackId}
          sourceTitle={voiceConversionTrackTitle}
        />
      )}
    </div>
  )
}
