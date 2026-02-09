import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WaveformPlayerProps {
  src: string
  isVisible?: boolean
  height?: number
  waveColor?: string
  progressColor?: string
  cursorColor?: string
  className?: string
  compact?: boolean
  autoPlay?: boolean
  onReady?: (duration: number) => void
  onPlay?: () => void
  onPause?: () => void
  onFinish?: () => void
  onTimeUpdate?: (currentTime: number) => void
}

export function WaveformPlayer({
  src,
  isVisible = true,
  height = 48,
  waveColor,
  progressColor,
  cursorColor,
  className,
  compact = false,
  autoPlay = false,
  onReady,
  onPlay,
  onPause,
  onFinish,
  onTimeUpdate,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Store callback props in refs so they don't trigger effect re-runs
  const onReadyRef = useRef(onReady)
  const onPlayRef = useRef(onPlay)
  const onPauseRef = useRef(onPause)
  const onFinishRef = useRef(onFinish)
  const onTimeUpdateRef = useRef(onTimeUpdate)

  // Keep refs in sync with latest props
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
  useEffect(() => {
    onPlayRef.current = onPlay
  }, [onPlay])
  useEffect(() => {
    onPauseRef.current = onPause
  }, [onPause])
  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Initialize WaveSurfer when component becomes visible or src changes
  useEffect(() => {
    if (!isVisible || !containerRef.current || !src) return

    // Clean up previous instance if src changed
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy()
      } catch {
        // Ignore AbortError from in-flight fetch during cleanup
      }
      wavesurferRef.current = null
    }

    // Reset state for new load
    setIsLoading(true)
    setError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    // Detect dark mode for color adaptation
    const isDark = document.documentElement.classList.contains('dark')

    // Professional colors with strong played/unplayed contrast
    // Light mode: vivid blue played, subtle dark unplayed
    // Dark mode: bright gold played, subtle white unplayed
    const defaultWaveColor =
      waveColor ||
      (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.18)')
    const defaultProgressColor =
      progressColor || (isDark ? '#E2B658' : '#2563EB')
    const defaultCursorColor = cursorColor || (isDark ? '#E2B658' : '#2563EB')

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor: defaultWaveColor,
      progressColor: defaultProgressColor,
      cursorColor: defaultCursorColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 4,
      normalize: true,
      hideScrollbar: true,
      fillParent: true,
      mediaControls: false,
      autoplay: autoPlay,
    })

    wavesurferRef.current = ws

    // Event handlers - use refs to avoid stale closures
    ws.on('ready', () => {
      setIsLoading(false)
      const dur = ws.getDuration()
      setDuration(dur)
      onReadyRef.current?.(dur)
    })

    ws.on('play', () => {
      setIsPlaying(true)
      onPlayRef.current?.()
    })

    ws.on('pause', () => {
      setIsPlaying(false)
      onPauseRef.current?.()
    })

    ws.on('finish', () => {
      setIsPlaying(false)
      onFinishRef.current?.()
    })

    ws.on('timeupdate', (time) => {
      setCurrentTime(time)
      onTimeUpdateRef.current?.(time)
    })

    ws.on('error', (err: Error) => {
      // Ignore AbortErrors - these happen during normal React cleanup
      if (err.name === 'AbortError') return
      if (err.message.toLowerCase().includes('abort')) return
      console.error('[WaveformPlayer] Error:', err)
      // Detect expired/404 URLs for a more helpful message
      const is404 =
        err.message.includes('404') || err.message.includes('Not Found')
      setError(
        is404
          ? 'Audio unavailable - file may have expired'
          : 'Failed to load audio',
      )
      setIsLoading(false)
    })

    // Load audio
    ws.load(src).catch((err: Error) => {
      if (err.name === 'AbortError') return
      console.error('[WaveformPlayer] Load error:', err)
    })

    return () => {
      try {
        ws.destroy()
      } catch {
        // Safe to ignore
      }
      wavesurferRef.current = null
    }
  }, [isVisible, src, height, waveColor, progressColor, cursorColor, autoPlay])

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }, [])

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 text-sm text-muted-foreground',
          className,
        )}
        style={{ height: Math.max(height, 32) }}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* Premium play button */}
        <Button
          size="icon-sm"
          variant={isPlaying ? 'default' : 'outline'}
          className={cn(
            'h-9 w-9 shrink-0 rounded-full transition-all duration-200',
            isPlaying && 'shadow-lg',
          )}
          onClick={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {/* Waveform container */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className={cn(
              'w-full rounded-lg transition-opacity duration-300',
              isLoading && 'opacity-30',
            )}
            style={{ height }}
          />
        </div>

        {/* Time display */}
        <div className="shrink-0 text-right">
          <span className="text-xs font-medium tabular-nums text-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {' / '}
            {formatTime(duration)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-4">
        {/* Large play button for full mode */}
        <Button
          size="icon-lg"
          variant={isPlaying ? 'default' : 'outline'}
          className={cn(
            'shrink-0 rounded-full transition-all duration-200',
            isPlaying && 'shadow-lg',
          )}
          onClick={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>

        {/* Waveform */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className={cn(
              'w-full rounded-lg transition-opacity duration-300',
              isLoading && 'opacity-30',
            )}
            style={{ height }}
          />
        </div>
      </div>

      {/* Time bar */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="tabular-nums font-medium">
          {formatTime(currentTime)}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}

// Lazy version with intersection observer
export function LazyWaveformPlayer(
  props: WaveformPlayerProps & { threshold?: number },
) {
  const { threshold = 0.1, ...playerProps } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold },
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  return (
    <div ref={containerRef}>
      {isVisible ? (
        <WaveformPlayer {...playerProps} isVisible={isVisible} />
      ) : (
        <div
          className="flex items-center gap-3"
          style={{ height: (playerProps.height || 48) + 8 }}
        >
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 h-[44px] bg-muted/30 rounded-lg animate-pulse" />
          <div className="w-20 h-4 bg-muted/50 rounded animate-pulse" />
        </div>
      )}
    </div>
  )
}
