import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertCircle,
  ChevronDown,
  Heart,
  Info,
  ListMusic,
  Loader2,
  Lock,
  Music,
  Settings2,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import type {Track} from '@/components/track-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  
  TrackCard,
  TrackCardSkeleton
} from '@/components/track-card'

export const Route = createFileRoute('/_app/music')({
  component: MusicPage,
})

type MusicProvider = 'elevenlabs' | 'minimax-v2' | 'minimax-v2.5'

interface Generation extends Track {
  progress: number
  error: string | null
}

function MusicPage() {
  const queryClient = useQueryClient()
  const trackListRef = useRef<HTMLDivElement>(null)

  // Form state
  const [provider, setProvider] = useState<MusicProvider>('elevenlabs')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [durationMs, setDurationMs] = useState<number | null>(null) // null = Auto
  const [forceInstrumental, setForceInstrumental] = useState(false)

  // Audio quality settings (MiniMax only)
  type SampleRateOption = '16000' | '24000' | '32000' | '44100'
  type BitrateOption = '32000' | '64000' | '128000' | '256000'
  type FormatOption = 'mp3' | 'wav' | 'pcm' | 'flac'

  const [sampleRate, setSampleRate] = useState<SampleRateOption>('44100')
  const [bitrate, setBitrate] = useState<BitrateOption>('256000')
  const [audioFormat, setAudioFormat] = useState<FormatOption>('mp3')
  const [showAudioSettings, setShowAudioSettings] = useState(false)

  // Filter state
  const [filterTab, setFilterTab] = useState<'all' | 'favorites'>('all')

  // Track action states
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(
    null,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

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
    if (provider === 'minimax-v2.5') {
      return hasMiniMaxKey
    }
    return hasFalKey
  }

  // Fetch active generations (refreshed via invalidation from status polling)
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

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: generations?.length || 0,
    getScrollElement: () => trackListRef.current,
    estimateSize: () => 100, // Estimated height of each track card
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
      } = {
        provider,
      }

      if (provider === 'elevenlabs') {
        data.prompt = prompt
        if (durationMs !== null) {
          data.durationMs = durationMs
        }
        if (forceInstrumental) {
          data.forceInstrumental = true
        }
      } else if (provider === 'minimax-v2') {
        data.prompt = prompt
        data.lyrics = lyrics
        // Add audio quality settings
        data.audioSettings = {
          sampleRate,
          bitrate,
          format: audioFormat,
        }
      } else if (provider === 'minimax-v2.5') {
        data.lyrics = lyrics
        if (prompt.trim()) {
          data.prompt = prompt
        }
        // Add audio quality settings
        data.audioSettings = {
          sampleRate,
          bitrate,
          format: audioFormat,
        }
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
        // Reset audio settings to defaults
        setSampleRate('44100')
        setBitrate('256000')
        setAudioFormat('mp3')
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
      return updateGenerationTitleFn({
        data: { generationId: trackId, title },
      })
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
    // Validate based on provider
    if (provider === 'elevenlabs') {
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
    } else if (provider === 'minimax-v2') {
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
    } else if (provider === 'minimax-v2.5') {
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
    }
    generateMutation.mutate()
  }

  const isGenerating = generateMutation.isPending
  const hasActiveGenerations = activeGenerations && activeGenerations.length > 0

  // Get provider-specific limits
  const getPromptLimit = () => {
    if (provider === 'elevenlabs' || provider === 'minimax-v2') return 300
    return 2000
  }

  const getLyricsLimit = () => {
    if (provider === 'minimax-v2') return 3000
    return 3500
  }

  // Helper for API key warning message
  const getApiKeyWarningMessage = () => {
    if (provider === 'minimax-v2.5' && !hasMiniMaxKey) {
      return {
        message: 'MiniMax API key required for MiniMax v2.5',
        linkText: 'Add your MiniMax API key',
      }
    }
    if (!hasFalKey) {
      return {
        message: 'fal.ai API key required for ElevenLabs and MiniMax v2',
        linkText: 'Add your fal.ai API key',
      }
    }
    return null
  }

  const apiKeyWarning = getApiKeyWarningMessage()

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="shrink-0 px-1 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Music Generation</h1>
        <p className="text-muted-foreground">
          Create AI-powered music with your own API keys
        </p>
      </div>

      {/* Platform Access Warning */}
      {!hasPlatformAccess && platformAccess !== undefined && (
        <div className="shrink-0 px-1 pb-4">
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    Platform Access Required
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Purchase platform access to start generating AI music. You
                    can still browse your existing tracks.
                  </p>
                </div>
                <Link to="/profile">
                  <Button size="sm" variant="default">
                    Get Access
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Key Warning */}
      {hasPlatformAccess && apiKeyWarning && (
        <div className="shrink-0 px-1 pb-4">
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    API Key Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {apiKeyWarning.message}.{' '}
                    <Link
                      to="/settings"
                      className="underline hover:no-underline font-medium"
                    >
                      {apiKeyWarning.linkText}
                    </Link>{' '}
                    in Settings to start generating.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - Scrollable Track List */}
      <div className="flex-1 min-h-0 px-1 pb-4 overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex items-center justify-between mb-4">
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
          <span className="text-sm text-muted-foreground">
            {totalTracks} {totalTracks === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {/* Track List */}
        <div
          ref={trackListRef}
          className="h-[calc(100%-3rem)] overflow-auto rounded-lg border bg-muted/20"
        >
          {loadingGenerations ? (
            <div className="p-4 space-y-3">
              <TrackCardSkeleton />
              <TrackCardSkeleton />
              <TrackCardSkeleton />
            </div>
          ) : generations && generations.length > 0 ? (
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
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="p-2"
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
                      isTogglingFavorite={togglingFavoriteId === track.id}
                      isDeleting={deletingId === track.id}
                      isRenaming={renamingId === track.id}
                      isUploading={uploadingId === track.id}
                      hasBunnySettings={hasBunnySettings}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Music className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">
                {filterTab === 'favorites'
                  ? 'No favorite tracks yet'
                  : 'Create your first track'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filterTab === 'favorites'
                  ? 'Click the heart icon on any track to add it to your favorites.'
                  : 'Use the form below to generate AI music with your preferred provider.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* In Progress Section */}
      {hasActiveGenerations && (
        <div className="shrink-0 px-1 pb-4">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="h-4 w-4 animate-spin" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="space-y-2">
                {activeGenerations.map((gen) => (
                  <div
                    key={gen.id}
                    className="flex items-center justify-between p-2 rounded-md bg-blue-100/50 dark:bg-blue-900/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-blue-900 dark:text-blue-100">
                        {gen.title || gen.prompt.slice(0, 50)}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {gen.status === 'pending'
                          ? 'Queued...'
                          : 'Generating...'}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300 tabular-nums">
                      {gen.progress || 0}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generation Form - Fixed at Bottom */}
      <div className="shrink-0 px-1 pb-1">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="space-y-4">
              {/* Provider Selection */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="provider" className="sr-only">
                    Model
                  </Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => setProvider(v as MusicProvider)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elevenlabs">
                        ElevenLabs Music - Text to Music
                      </SelectItem>
                      <SelectItem value="minimax-v2">
                        MiniMax v2 - Style + Lyrics (via fal.ai)
                      </SelectItem>
                      <SelectItem value="minimax-v2.5">
                        MiniMax v2.5 - Lyrics + Optional Style (Direct)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {provider === 'elevenlabs' && (
                        <p>
                          Generate music from a text description. Great for
                          instrumentals and general music. Requires fal.ai API
                          key.
                        </p>
                      )}
                      {provider === 'minimax-v2' && (
                        <p>
                          Generate music with style prompt and lyrics. Requires
                          fal.ai API key.
                        </p>
                      )}
                      {provider === 'minimax-v2.5' && (
                        <p>
                          Generate music with lyrics and optional style. Uses
                          direct MiniMax API - requires MiniMax API key.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Prompt/Style Field */}
              {(provider === 'elevenlabs' || provider === 'minimax-v2') && (
                <div className="space-y-1">
                  <Label htmlFor="prompt">
                    {provider === 'elevenlabs'
                      ? 'Music Description'
                      : 'Style Prompt'}
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder={
                      provider === 'elevenlabs'
                        ? 'Describe your music... e.g., "Upbeat electronic dance track with energetic synths, driving bass, and euphoric melodies."'
                        : 'Describe the musical style... e.g., "Upbeat pop song with acoustic guitar and soft vocals"'
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    disabled={isGenerating}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {prompt.length}/{getPromptLimit()} characters
                  </p>
                </div>
              )}

              {/* ElevenLabs: Duration + Instrumental Controls */}
              {provider === 'elevenlabs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Duration Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
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
                      value={[
                        durationMs === null ? 0 : Math.round(durationMs / 1000),
                      ]}
                      onValueChange={([val]) =>
                        setDurationMs(val === 0 ? null : val * 1000)
                      }
                      disabled={isGenerating}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Auto
                      </span>
                      <div className="flex gap-1">
                        {[30, 60, 120, 180, 300].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setDurationMs(sec * 1000)}
                            disabled={isGenerating}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              durationMs === sec * 1000
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDurationMs(null)}
                          disabled={isGenerating}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            durationMs === null
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                          }`}
                        >
                          Auto
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Instrumental Toggle */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="force-instrumental"
                      className="flex items-center gap-2"
                    >
                      <Music className="h-3.5 w-3.5" />
                      Instrumental Only
                    </Label>
                    <div className="flex items-center gap-3 pt-1">
                      <Switch
                        id="force-instrumental"
                        checked={forceInstrumental}
                        onCheckedChange={setForceInstrumental}
                        disabled={isGenerating}
                      />
                      <span className="text-xs text-muted-foreground">
                        {forceInstrumental
                          ? 'No vocals - pure instrumental'
                          : 'Model decides (may include vocals)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Style Prompt for MiniMax v2.5 */}
              {provider === 'minimax-v2.5' && (
                <div className="space-y-1">
                  <Label htmlFor="prompt">Style Prompt (Optional)</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Optional style description... e.g., 'Soft acoustic ballad with piano'"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    disabled={isGenerating}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {prompt.length}/{getPromptLimit()} characters
                  </p>
                </div>
              )}

              {/* Lyrics Field for MiniMax */}
              {(provider === 'minimax-v2' || provider === 'minimax-v2.5') && (
                <div className="space-y-1">
                  <Label htmlFor="lyrics">Lyrics</Label>
                  <Textarea
                    id="lyrics"
                    placeholder={`[Verse]
Walking down the street tonight
Stars are shining oh so bright

[Chorus]
This is where we belong
Singing our favorite song`}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={4}
                    disabled={isGenerating}
                    className="resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {lyrics.length}/{getLyricsLimit()} characters. Use [Verse],
                    [Chorus], [Bridge], [Intro], [Outro] tags. Duration is
                    determined by lyrics length.
                  </p>
                </div>
              )}

              {/* Audio Quality Settings (MiniMax only) */}
              {(provider === 'minimax-v2' || provider === 'minimax-v2.5') && (
                <Collapsible
                  open={showAudioSettings}
                  onOpenChange={setShowAudioSettings}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 w-full justify-between px-2 h-8 text-muted-foreground hover:text-foreground"
                      disabled={isGenerating}
                    >
                      <span className="flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5" />
                        Audio Quality
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          showAudioSettings ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/50 border">
                      {/* Sample Rate */}
                      <div className="space-y-1">
                        <Label
                          htmlFor="sample-rate"
                          className="text-xs text-muted-foreground"
                        >
                          Sample Rate
                        </Label>
                        <Select
                          value={sampleRate}
                          onValueChange={(v) =>
                            setSampleRate(v as SampleRateOption)
                          }
                          disabled={isGenerating}
                        >
                          <SelectTrigger id="sample-rate" className="h-8">
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

                      {/* Bitrate */}
                      <div className="space-y-1">
                        <Label
                          htmlFor="bitrate"
                          className="text-xs text-muted-foreground"
                        >
                          Bitrate
                        </Label>
                        <Select
                          value={bitrate}
                          onValueChange={(v) => setBitrate(v as BitrateOption)}
                          disabled={isGenerating}
                        >
                          <SelectTrigger id="bitrate" className="h-8">
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

                      {/* Format */}
                      <div className="space-y-1">
                        <Label
                          htmlFor="format"
                          className="text-xs text-muted-foreground"
                        >
                          Format
                        </Label>
                        <Select
                          value={audioFormat}
                          onValueChange={(v) =>
                            setAudioFormat(v as FormatOption)
                          }
                          disabled={isGenerating}
                        >
                          <SelectTrigger id="format" className="h-8">
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
                    <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                      Higher sample rate and bitrate = better quality but larger
                      file size
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={
                  isGenerating || !hasRequiredKey() || !hasPlatformAccess
                }
                className="w-full"
                size="lg"
              >
                {!hasPlatformAccess ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Purchase Access to Generate
                  </>
                ) : isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Generation...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-4 w-4" />
                    Generate Music
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
