/**
 * Music Generation Service
 *
 * Integrates with fal.ai for ElevenLabs Music and MiniMax v2 models.
 * Supports mock mode for development without API keys.
 *
 * Providers:
 * - elevenlabs: ElevenLabs Music via fal.ai (prompt-based, no lyrics required)
 * - minimax-v2: MiniMax Music v2 via fal.ai (prompt + lyrics, no reference audio)
 * - minimax-v2.5: MiniMax Music v2.5 via direct API (handled separately in minimax.service.ts)
 */

import { fal } from '@fal-ai/client'

// ============================================================================
// Configuration
// ============================================================================

const MOCK_MUSIC = process.env.MOCK_MUSIC === 'true'

// fal.ai model endpoints
const FAL_MODELS = {
  elevenlabs: 'fal-ai/elevenlabs/music',
  'minimax-v2': 'fal-ai/minimax-music/v2',
} as const

// Mock audio URL for development
const MOCK_AUDIO_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

// ============================================================================
// Types
// ============================================================================

export type MusicProvider = 'elevenlabs' | 'minimax-v2' | 'minimax-v2.5'

export interface AudioSettings {
  sampleRate?: number // 16000, 24000, 32000, 44100
  bitrate?: number // 32000, 64000, 128000, 256000
  format?: string // mp3, wav, pcm, flac
}

export interface MusicGenerationInput {
  provider: MusicProvider
  prompt: string // Style/mood description
  lyrics?: string // Required for MiniMax providers
  durationMs?: number // Optional duration in milliseconds (ElevenLabs only, 3000-600000)
  forceInstrumental?: boolean // Force instrumental output (ElevenLabs only)
  outputFormat?: string // e.g., "mp3_44100_128"
  audioSettings?: AudioSettings // Audio quality settings (MiniMax only)
}

export interface MusicGenerationResult {
  requestId: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  audioUrl?: string
  error?: string
  progress?: number
  logs?: Array<string>
}

export interface QueueSubmitResult {
  requestId: string
  statusUrl?: string
  responseUrl?: string
  cancelUrl?: string
}

// ============================================================================
// Mock Implementation
// ============================================================================

function createMockRequestId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function mockSubmitGeneration(
  input: MusicGenerationInput,
): Promise<QueueSubmitResult> {
  console.log('[MOCK] Music generation submitted:', input)
  return {
    requestId: createMockRequestId(),
  }
}

async function mockCheckStatus(
  requestId: string,
): Promise<MusicGenerationResult> {
  console.log('[MOCK] Checking status for:', requestId)

  // Simulate different statuses based on time
  const mockStartTime = parseInt(requestId.split('-')[1] || '0', 10)
  const elapsed = Date.now() - mockStartTime

  if (elapsed < 2000) {
    return {
      requestId,
      status: 'IN_QUEUE',
      progress: 0,
    }
  } else if (elapsed < 5000) {
    return {
      requestId,
      status: 'IN_PROGRESS',
      progress: Math.min(90, Math.floor((elapsed - 2000) / 30)),
      logs: ['Generating music...'],
    }
  } else {
    return {
      requestId,
      status: 'COMPLETED',
      audioUrl: MOCK_AUDIO_URL,
      progress: 100,
    }
  }
}

// ============================================================================
// fal.ai Implementation
// ============================================================================

/**
 * Configure fal client with user's API key
 */
function configureFalClient(apiKey: string) {
  fal.config({
    credentials: apiKey,
  })
}

/**
 * Submit music generation to fal.ai queue
 */
async function falSubmitGeneration(
  apiKey: string,
  input: MusicGenerationInput,
): Promise<QueueSubmitResult> {
  configureFalClient(apiKey)

  // Only ElevenLabs and MiniMax v2 use fal.ai
  if (input.provider === 'minimax-v2.5') {
    throw new Error('MiniMax v2.5 should use direct API, not fal.ai')
  }

  const modelId = FAL_MODELS[input.provider]

  let falInput: Record<string, unknown>

  if (input.provider === 'elevenlabs') {
    // ElevenLabs Music - prompt-based generation with duration & instrumental controls
    falInput = {
      prompt: input.prompt,
      output_format: input.outputFormat || 'mp3_44100_128',
    }

    // Add duration if specified (in milliseconds, 3000-600000)
    if (input.durationMs) {
      falInput.music_length_ms = input.durationMs
    }

    // Force instrumental output (no vocals)
    if (input.forceInstrumental) {
      falInput.force_instrumental = true
    }
  } else if (input.provider === 'minimax-v2') {
    // MiniMax Music v2 - requires prompt AND lyrics_prompt
    if (!input.lyrics) {
      throw new Error('MiniMax v2 requires lyrics')
    }

    falInput = {
      prompt: input.prompt, // Style/mood description (10-300 chars)
      lyrics_prompt: input.lyrics, // Lyrics content (10-3000 chars)
      audio_setting: {
        sample_rate: input.audioSettings?.sampleRate || 44100,
        bitrate: input.audioSettings?.bitrate || 256000,
        format: input.audioSettings?.format || 'mp3',
      },
    }
  } else {
    throw new Error(`Unknown provider: ${input.provider}`)
  }

  const result = await fal.queue.submit(modelId, {
    input: falInput,
  })

  return {
    requestId: result.request_id,
  }
}

/**
 * Check status of a fal.ai queue request
 */
async function falCheckStatus(
  apiKey: string,
  provider: MusicProvider,
  requestId: string,
): Promise<MusicGenerationResult> {
  configureFalClient(apiKey)

  // Only ElevenLabs and MiniMax v2 use fal.ai
  if (provider === 'minimax-v2.5') {
    throw new Error('MiniMax v2.5 should use direct API, not fal.ai')
  }

  const modelId = FAL_MODELS[provider]

  const status = await fal.queue.status(modelId, {
    requestId,
    logs: true,
  })

  // Map fal.ai status to our status
  const statusMap: Record<string, MusicGenerationResult['status']> = {
    IN_QUEUE: 'IN_QUEUE',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  }

  const result: MusicGenerationResult = {
    requestId,
    status: statusMap[status.status] || 'IN_PROGRESS',
    logs: status.logs?.map((log: { message: string }) => log.message),
  }

  // If completed, fetch the result
  if (status.status === 'COMPLETED') {
    const fullResult = await fal.queue.result(modelId, { requestId })
    const data = fullResult.data as { audio?: { url?: string } }
    result.audioUrl = data?.audio?.url
    result.progress = 100
  } else if (status.status === 'FAILED') {
    result.error = 'Generation failed'
  }

  return result
}

/**
 * Cancel a fal.ai queue request
 */
async function falCancelGeneration(
  apiKey: string,
  provider: MusicProvider,
  requestId: string,
): Promise<void> {
  configureFalClient(apiKey)

  // Only ElevenLabs and MiniMax v2 use fal.ai
  if (provider === 'minimax-v2.5') {
    throw new Error('MiniMax v2.5 does not support cancellation')
  }

  const modelId = FAL_MODELS[provider]

  await fal.queue.cancel(modelId, { requestId })
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Submit a music generation request (fal.ai providers only)
 *
 * Note: For minimax-v2.5, use generateMusicWithMiniMax from minimax.service.ts instead
 */
export async function submitMusicGeneration(
  apiKey: string | null,
  input: MusicGenerationInput,
): Promise<QueueSubmitResult> {
  if (input.provider === 'minimax-v2.5') {
    throw new Error(
      'Use generateMusicWithMiniMax() for MiniMax v2.5 direct API',
    )
  }

  if (MOCK_MUSIC) {
    return mockSubmitGeneration(input)
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required for music generation')
  }

  return falSubmitGeneration(apiKey, input)
}

/**
 * Check the status of a music generation request (fal.ai providers only)
 */
export async function checkMusicGenerationStatus(
  apiKey: string | null,
  provider: MusicProvider,
  requestId: string,
): Promise<MusicGenerationResult> {
  if (provider === 'minimax-v2.5') {
    // MiniMax v2.5 is synchronous, no status check needed
    throw new Error('MiniMax v2.5 does not support status polling')
  }

  if (MOCK_MUSIC) {
    return mockCheckStatus(requestId)
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required to check status')
  }

  return falCheckStatus(apiKey, provider, requestId)
}

/**
 * Cancel a music generation request
 */
export async function cancelMusicGeneration(
  apiKey: string | null,
  provider: MusicProvider,
  requestId: string,
): Promise<void> {
  if (provider === 'minimax-v2.5') {
    console.log('[MiniMax v2.5] Cancellation not supported')
    return
  }

  if (MOCK_MUSIC) {
    console.log('[MOCK] Canceling generation:', requestId)
    return
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required to cancel generation')
  }

  return falCancelGeneration(apiKey, provider, requestId)
}

/**
 * Check if music service is available (mock mode or real API)
 */
export function isMusicServiceAvailable(): boolean {
  return true // Always available - either mock or real
}

/**
 * Check if we're in mock mode
 */
export function isMockMode(): boolean {
  return MOCK_MUSIC
}

/**
 * Check if a provider uses fal.ai (queue-based) or direct API
 */
export function isQueueBasedProvider(provider: MusicProvider): boolean {
  return provider === 'elevenlabs' || provider === 'minimax-v2'
}
