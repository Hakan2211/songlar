/**
 * AudioRecorder Component
 *
 * A microphone recording component that captures audio from the user's
 * microphone using the MediaRecorder API. Supports recording, playback
 * preview, re-recording, and outputs a Blob for upload.
 *
 * States: idle -> recording -> recorded
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface AudioRecorderProps {
  /** Called when a recording is completed with the audio blob */
  onRecordingComplete: (blob: Blob) => void
  /** Called when the recording is discarded */
  onRecordingDiscard?: () => void
  /** Disable the recorder */
  disabled?: boolean
  /** Minimum recording duration in seconds (shows warning below) */
  minDuration?: number
  /** Maximum recording duration in seconds (auto-stops) */
  maxDuration?: number
  /** Additional class names */
  className?: string
}

type RecorderState = 'idle' | 'recording' | 'recorded'

// ============================================================================
// Helpers
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Get the best supported audio MIME type for MediaRecorder */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]

  for (const type of types) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }

  // Fallback - let the browser choose
  return ''
}

// ============================================================================
// Component
// ============================================================================

export function AudioRecorder({
  onRecordingComplete,
  onRecordingDiscard,
  disabled = false,
  minDuration = 10,
  maxDuration = 120,
  className,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobRef = useRef<Blob | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup()
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopRecordingCleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        'Microphone recording is not supported in this browser. Make sure you are using HTTPS.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream
      chunksRef.current = []

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const mimeUsed = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeUsed })
        blobRef.current = blob

        // Create preview URL
        const url = URL.createObjectURL(blob)
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl)
        }
        setAudioUrl(url)
        setState('recorded')
        onRecordingComplete(blob)
      }

      recorder.onerror = () => {
        setError('Recording error occurred. Please try again.')
        stopRecordingCleanup()
        setState('idle')
      }

      // Start recording with timesliced chunks (1 second)
      recorder.start(1000)
      setState('recording')
      setElapsed(0)

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1
          if (next >= maxDuration) {
            // Auto-stop at max duration
            stopRecording()
          }
          return next
        })
      }, 1000)
    } catch (err) {
      if (err instanceof DOMException) {
        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError'
        ) {
          setError(
            'Microphone access denied. Please allow microphone access in your browser settings.',
          )
        } else if (err.name === 'NotFoundError') {
          setError(
            'No microphone found. Please connect a microphone and try again.',
          )
        } else {
          setError(`Microphone error: ${err.message}`)
        }
      } else {
        setError('Failed to start recording. Please try again.')
      }
      setState('idle')
    }
  }, [maxDuration, onRecordingComplete, audioUrl, stopRecordingCleanup])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const discardRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setAudioUrl(null)
    blobRef.current = null
    setElapsed(0)
    setIsPlaying(false)
    setState('idle')
    onRecordingDiscard?.()
  }, [audioUrl, onRecordingDiscard])

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return

    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.onended = () => {
      setIsPlaying(false)
      audioRef.current = null
    }
    audio.onerror = () => {
      setIsPlaying(false)
      audioRef.current = null
    }

    audio.play()
    setIsPlaying(true)
  }, [audioUrl, isPlaying])

  // Stop playback when leaving recorded state
  useEffect(() => {
    if (state !== 'recorded' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
    }
  }, [state])

  const isTooShort = elapsed < minDuration

  return (
    <div className={cn('space-y-3', className)}>
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Idle state */}
      {state === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full border-2 border-dashed"
            onClick={startRecording}
            disabled={disabled}
          >
            <Mic className="h-6 w-6" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Click to start recording. Speak clearly for at least {minDuration}{' '}
            seconds.
          </p>
        </div>
      )}

      {/* Recording state */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3 py-4">
          {/* Animated recording indicator */}
          <div className="relative">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={stopRecording}
            >
              <Square className="h-5 w-5 fill-current" />
            </Button>
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30 pointer-events-none" />
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-sm font-mono tabular-nums font-medium">
              {formatTime(elapsed)}
            </span>
          </div>

          {/* Duration hint */}
          {isTooShort && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Record at least {minDuration}s for best results (
              {minDuration - elapsed}s remaining)
            </p>
          )}
          {!isTooShort && (
            <p className="text-xs text-muted-foreground">
              Click the stop button when you are done
            </p>
          )}
        </div>
      )}

      {/* Recorded state */}
      {state === 'recorded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
            {/* Play/Pause */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 shrink-0"
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Recording ({formatTime(elapsed)})
              </p>
              {isTooShort && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Short recording - at least {minDuration}s recommended
                </p>
              )}
            </div>

            {/* Re-record / Discard */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8"
                onClick={() => {
                  discardRecording()
                  // Small delay to allow state reset before starting new recording
                  setTimeout(() => startRecording(), 100)
                }}
                title="Re-record"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  discardRecording()
                }}
                title="Discard"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
