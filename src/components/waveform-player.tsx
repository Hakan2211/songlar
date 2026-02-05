import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Loader2, Pause, Play } from 'lucide-react'
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

    // Professional solid colors with strong played/unplayed contrast:
    // Dark mode: bright gold played, subtle white unplayed
    // Light mode: vivid blue played, subtle dark unplayed
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
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
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
      // when ws.destroy() is called while ws.load() is still in-flight
      if (err.name === 'AbortError') {
        return
      }
      if (err.message?.toLowerCase().includes('abort')) {
        return
      }
      console.error('[WaveformPlayer] Error:', err)
      setError('Failed to load audio')
      setIsLoading(false)
    })

    // Load audio -- catch the promise so that AbortError from destroy()
    // aborting an in-flight fetch doesn't surface as unhandled rejection
    ws.load(src).catch((err: Error) => {
      if (err.name === 'AbortError') return
      console.error('[WaveformPlayer] Load error:', err)
    })

    return () => {
      try {
        ws.destroy()
      } catch {
        // WaveSurfer.destroy() throws AbortError when audio fetch is
        // still in-flight. Expected during React Strict Mode double-invoke
        // and normal component cleanup -- safe to ignore.
      }
      wavesurferRef.current = null
    }
    // Only re-initialize when src, visibility, or visual config changes.
    // Callback props are handled via refs and don't need to be in deps.
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
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        {error}
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
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

        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className={cn('w-full', isLoading && 'opacity-50')}
            style={{ height }}
          />
        </div>

        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-20 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10 shrink-0 rounded-full"
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

        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className={cn('w-full', isLoading && 'opacity-50')}
            style={{ height }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{formatTime(currentTime)}</span>
        <span className="tabular-nums">{formatTime(duration)}</span>
      </div>
    </div>
  )
}

// Export a lazy version for use with IntersectionObserver
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
          // Once visible, stop observing
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
          className="flex items-center justify-center bg-muted/30 rounded"
          style={{ height: playerProps.height || 48 }}
        >
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
