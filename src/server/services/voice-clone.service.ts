/**
 * Voice Clone Service
 *
 * Integrates with fal.ai for voice cloning using MiniMax and Qwen models.
 * Supports mock mode for development without API keys.
 *
 * Providers:
 * - minimax: MiniMax Voice Clone - returns a custom_voice_id for use with TTS
 * - qwen: Qwen 3 TTS Clone Voice - returns a speaker embedding file (.safetensors)
 */

import { fal } from '@fal-ai/client'

// ============================================================================
// Configuration
// ============================================================================

const MOCK_VOICE_CLONE = process.env.MOCK_VOICE_CLONE === 'true'

// fal.ai model endpoints for voice cloning
const FAL_VOICE_CLONE_MODELS = {
  minimax: 'fal-ai/minimax/voice-clone',
  qwen: 'fal-ai/qwen-3-tts/clone-voice/1.7b',
} as const

// Mock audio URLs for development
const MOCK_PREVIEW_AUDIO_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
const MOCK_EMBEDDING_URL =
  'https://storage.googleapis.com/mock/speaker_embedding.safetensors'

// ============================================================================
// Types
// ============================================================================

export type VoiceCloneProvider = 'minimax' | 'qwen'

export interface MiniMaxCloneInput {
  audioUrl: string
  noiseReduction?: boolean
  volumeNormalization?: boolean
  previewText?: string // Optional text to generate TTS preview
  model?:
    | 'speech-02-hd'
    | 'speech-02-turbo'
    | 'speech-01-hd'
    | 'speech-01-turbo'
}

export interface QwenCloneInput {
  audioUrl: string
  referenceText?: string // Optional reference text for better quality
}

export interface VoiceCloneResult {
  requestId: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  // MiniMax-specific
  minimaxVoiceId?: string
  previewAudioUrl?: string
  // Qwen-specific
  speakerEmbeddingUrl?: string
  // Common
  error?: string
  logs?: Array<string>
}

export interface QueueSubmitResult {
  requestId: string
}

// ============================================================================
// Mock Implementation
// ============================================================================

function createMockRequestId(): string {
  return `mock-voice-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function mockSubmitMiniMaxClone(
  input: MiniMaxCloneInput,
): Promise<QueueSubmitResult> {
  console.log('[MOCK] MiniMax voice clone submitted:', input)
  return {
    requestId: createMockRequestId(),
  }
}

async function mockSubmitQwenClone(
  input: QwenCloneInput,
): Promise<QueueSubmitResult> {
  console.log('[MOCK] Qwen voice clone submitted:', input)
  return {
    requestId: createMockRequestId(),
  }
}

async function mockCheckStatus(
  provider: VoiceCloneProvider,
  requestId: string,
): Promise<VoiceCloneResult> {
  console.log('[MOCK] Checking voice clone status for:', requestId)

  // Simulate different statuses based on time
  const mockStartTime = parseInt(requestId.split('-')[2] || '0', 10)
  const elapsed = Date.now() - mockStartTime

  if (elapsed < 2000) {
    return {
      requestId,
      status: 'IN_QUEUE',
    }
  } else if (elapsed < 4000) {
    return {
      requestId,
      status: 'IN_PROGRESS',
      logs: ['Cloning voice...'],
    }
  } else {
    // Completed
    if (provider === 'minimax') {
      return {
        requestId,
        status: 'COMPLETED',
        minimaxVoiceId: `mock-voice-id-${Date.now()}`,
        previewAudioUrl: MOCK_PREVIEW_AUDIO_URL,
      }
    } else {
      return {
        requestId,
        status: 'COMPLETED',
        speakerEmbeddingUrl: MOCK_EMBEDDING_URL,
      }
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
 * Submit MiniMax voice clone to fal.ai queue
 */
async function falSubmitMiniMaxClone(
  apiKey: string,
  input: MiniMaxCloneInput,
): Promise<QueueSubmitResult> {
  configureFalClient(apiKey)

  const falInput: Record<string, unknown> = {
    audio_url: input.audioUrl,
  }

  if (input.noiseReduction !== undefined) {
    falInput.noise_reduction = input.noiseReduction
  }

  if (input.volumeNormalization !== undefined) {
    falInput.need_volume_normalization = input.volumeNormalization
  }

  if (input.previewText) {
    falInput.text = input.previewText
  }

  if (input.model) {
    falInput.model = input.model
  }

  const result = await fal.queue.submit(FAL_VOICE_CLONE_MODELS.minimax, {
    input: falInput as { audio_url: string },
  })

  return {
    requestId: result.request_id,
  }
}

/**
 * Submit Qwen voice clone to fal.ai queue
 */
async function falSubmitQwenClone(
  apiKey: string,
  input: QwenCloneInput,
): Promise<QueueSubmitResult> {
  configureFalClient(apiKey)

  const falInput: Record<string, unknown> = {
    audio_url: input.audioUrl,
  }

  if (input.referenceText) {
    falInput.reference_text = input.referenceText
  }

  const result = await fal.queue.submit(FAL_VOICE_CLONE_MODELS.qwen, {
    input: falInput as { audio_url: string },
  })

  return {
    requestId: result.request_id,
  }
}

/**
 * Check status of a fal.ai voice clone request
 */
async function falCheckStatus(
  apiKey: string,
  provider: VoiceCloneProvider,
  requestId: string,
): Promise<VoiceCloneResult> {
  configureFalClient(apiKey)

  const modelId = FAL_VOICE_CLONE_MODELS[provider]

  const status = await fal.queue.status(modelId, {
    requestId,
    logs: true,
  })

  // Map fal.ai status to our status
  const statusMap: Record<string, VoiceCloneResult['status']> = {
    IN_QUEUE: 'IN_QUEUE',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  }

  const statusString = status.status as string
  const logs = 'logs' in status ? status.logs : undefined

  const mappedStatus: VoiceCloneResult['status'] =
    statusString in statusMap ? statusMap[statusString] : 'IN_PROGRESS'

  const result: VoiceCloneResult = {
    requestId,
    status: mappedStatus,
    logs: logs?.map((log: { message: string }) => log.message),
  }

  // Handle completed status
  if (statusString === 'COMPLETED') {
    const fullResult = await fal.queue.result(modelId, { requestId })

    if (provider === 'minimax') {
      const data = fullResult.data as {
        custom_voice_id?: string
        audio?: { url?: string }
      }
      result.minimaxVoiceId = data.custom_voice_id
      result.previewAudioUrl = data.audio?.url
    } else {
      // Qwen returns speaker embedding
      const data = fullResult.data as {
        speaker_embedding?: { url?: string }
      }
      result.speakerEmbeddingUrl = data.speaker_embedding?.url
    }
  } else if (statusString === 'FAILED') {
    result.error = 'Voice cloning failed'
  }

  return result
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Submit a MiniMax voice clone request
 */
export async function submitMiniMaxVoiceClone(
  apiKey: string | null,
  input: MiniMaxCloneInput,
): Promise<QueueSubmitResult> {
  if (MOCK_VOICE_CLONE) {
    return mockSubmitMiniMaxClone(input)
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required for voice cloning')
  }

  return falSubmitMiniMaxClone(apiKey, input)
}

/**
 * Submit a Qwen voice clone request
 */
export async function submitQwenVoiceClone(
  apiKey: string | null,
  input: QwenCloneInput,
): Promise<QueueSubmitResult> {
  if (MOCK_VOICE_CLONE) {
    return mockSubmitQwenClone(input)
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required for voice cloning')
  }

  return falSubmitQwenClone(apiKey, input)
}

/**
 * Check the status of a voice clone request
 */
export async function checkVoiceCloneStatus(
  apiKey: string | null,
  provider: VoiceCloneProvider,
  requestId: string,
): Promise<VoiceCloneResult> {
  if (MOCK_VOICE_CLONE) {
    return mockCheckStatus(provider, requestId)
  }

  if (!apiKey) {
    throw new Error('fal.ai API key is required to check status')
  }

  return falCheckStatus(apiKey, provider, requestId)
}

/**
 * Upload an audio buffer to fal.ai storage and return a URL.
 *
 * Uses fal.storage.upload() to get a fal.ai-hosted URL that can be
 * used as the audio_url parameter for voice cloning requests.
 */
export async function uploadAudioToFalStorage(
  apiKey: string,
  audioBuffer: Buffer,
  filename: string,
  contentType: string = 'audio/webm',
): Promise<string> {
  if (MOCK_VOICE_CLONE) {
    console.log('[MOCK] Uploading audio to fal.ai storage:', filename)
    return `https://fal.media/files/mock/${filename}`
  }

  configureFalClient(apiKey)

  const blob = new Blob([audioBuffer as BlobPart], { type: contentType })
  const file = new File([blob], filename, { type: contentType })
  const url = await fal.storage.upload(file)

  console.log('[fal.ai] Audio uploaded to storage:', url)
  return url
}

/**
 * Check if voice clone service is available (mock mode or real API)
 */
export function isVoiceCloneServiceAvailable(): boolean {
  return true // Always available - either mock or real
}

/**
 * Check if we're in mock mode
 */
export function isVoiceCloneMockMode(): boolean {
  return MOCK_VOICE_CLONE
}
