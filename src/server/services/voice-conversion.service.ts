/**
 * Voice Conversion Service
 *
 * Integrates with Replicate for voice conversion using:
 * - RVC v2 (zsxkib/realistic-voice-cloning) - custom RVC models
 *
 * Supports mock mode for development without API keys.
 */

import Replicate from 'replicate'

// ============================================================================
// Configuration
// ============================================================================

const MOCK_VOICE_CONVERSION = process.env.MOCK_VOICE_CONVERSION === 'true'

// Replicate model versions
// Note: Community models require the full version hash to use the
// POST /v1/predictions endpoint. Using just the model name routes to
// POST /v1/models/{owner}/{name}/predictions which only works for official models.
const RVC_V2_MODEL_VERSION =
  'zsxkib/realistic-voice-cloning:0a9c7c558af4c0f20667c1bd1260ce32a2879944a0b9e44e1398660c077b1550' as const

// Mock audio URL for development
const MOCK_CONVERTED_AUDIO_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'

// ============================================================================
// Types
// ============================================================================

export type VoiceConversionProvider = 'rvc-v2'

export interface RVCInput {
  sourceAudioUrl: string
  rvcModelUrl: string // URL to .zip file containing RVC model
  pitchShift?: number // Semitones (-12 to 12)
  indexRate?: number // 0-1, controls how much of index to use
  filterRadius?: number // 0-7, median filtering
  rmsMixRate?: number // 0-1, volume envelope mixing
  protect?: number // 0-0.5, protect voiceless consonants
}

export interface VoiceConversionResult {
  predictionId: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  outputAudioUrl?: string
  error?: string
  progress?: number
  logs?: string
}

export interface PredictionSubmitResult {
  predictionId: string
}

// ============================================================================
// Mock Implementation
// ============================================================================

function createMockPredictionId(): string {
  return `mock-pred-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function mockSubmitRVC(input: RVCInput): Promise<PredictionSubmitResult> {
  console.log('[MOCK] RVC v2 conversion submitted:', input)
  return {
    predictionId: createMockPredictionId(),
  }
}

async function mockCheckStatus(
  predictionId: string,
): Promise<VoiceConversionResult> {
  console.log('[MOCK] Checking voice conversion status for:', predictionId)

  // Simulate different statuses based on time
  const mockStartTime = parseInt(predictionId.split('-')[2] || '0', 10)
  const elapsed = Date.now() - mockStartTime

  if (elapsed < 2000) {
    return {
      predictionId,
      status: 'starting',
      progress: 0,
    }
  } else if (elapsed < 6000) {
    const progress = Math.min(90, Math.floor((elapsed - 2000) / 40))
    return {
      predictionId,
      status: 'processing',
      progress,
      logs: 'Processing audio...',
    }
  } else {
    return {
      predictionId,
      status: 'succeeded',
      outputAudioUrl: MOCK_CONVERTED_AUDIO_URL,
      progress: 100,
    }
  }
}

// ============================================================================
// Replicate Implementation
// ============================================================================

/**
 * Create Replicate client with user's API key
 */
function createReplicateClient(apiKey: string): Replicate {
  return new Replicate({
    auth: apiKey,
  })
}

/**
 * Submit RVC v2 conversion to Replicate
 */
async function replicateSubmitRVC(
  apiKey: string,
  input: RVCInput,
): Promise<PredictionSubmitResult> {
  const replicate = createReplicateClient(apiKey)

  const replicateInput: Record<string, unknown> = {
    song_input: input.sourceAudioUrl,
    rvc_model: 'CUSTOM',
    custom_rvc_model_download_url: input.rvcModelUrl,
  }

  // Optional parameters
  if (input.pitchShift !== undefined) {
    replicateInput.pitch_change = input.pitchShift
  }

  if (input.indexRate !== undefined) {
    replicateInput.index_rate = input.indexRate
  }

  if (input.filterRadius !== undefined) {
    replicateInput.filter_radius = input.filterRadius
  }

  if (input.rmsMixRate !== undefined) {
    replicateInput.rms_mix_rate = input.rmsMixRate
  }

  if (input.protect !== undefined) {
    replicateInput.protect = input.protect
  }

  const prediction = await replicate.predictions.create({
    version: RVC_V2_MODEL_VERSION,
    input: replicateInput,
  })

  return {
    predictionId: prediction.id,
  }
}

/**
 * Check status of a Replicate prediction
 */
async function replicateCheckStatus(
  apiKey: string,
  predictionId: string,
): Promise<VoiceConversionResult> {
  const replicate = createReplicateClient(apiKey)

  const prediction = await replicate.predictions.get(predictionId)

  const result: VoiceConversionResult = {
    predictionId,
    status: prediction.status as VoiceConversionResult['status'],
    logs: prediction.logs || undefined,
  }

  if (prediction.status === 'succeeded') {
    // Output can be string or array of strings
    const output = prediction.output
    if (typeof output === 'string') {
      result.outputAudioUrl = output
    } else if (Array.isArray(output) && output.length > 0) {
      result.outputAudioUrl = output[0]
    }
    result.progress = 100
  } else if (prediction.status === 'failed') {
    result.error =
      typeof prediction.error === 'string'
        ? prediction.error
        : 'Conversion failed'
  } else if (prediction.status === 'processing') {
    // Estimate progress based on logs if available
    result.progress = 50 // Default to 50% for processing
  } else if (prediction.status === 'starting') {
    result.progress = 10
  }

  return result
}

/**
 * Cancel a Replicate prediction
 */
async function replicateCancelPrediction(
  apiKey: string,
  predictionId: string,
): Promise<void> {
  const replicate = createReplicateClient(apiKey)
  await replicate.predictions.cancel(predictionId)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Submit an RVC v2 voice conversion request
 */
export async function submitRVCConversion(
  apiKey: string | null,
  input: RVCInput,
): Promise<PredictionSubmitResult> {
  if (MOCK_VOICE_CONVERSION) {
    return mockSubmitRVC(input)
  }

  if (!apiKey) {
    throw new Error('Replicate API key is required for voice conversion')
  }

  return replicateSubmitRVC(apiKey, input)
}

/**
 * Check the status of a voice conversion request
 */
export async function checkVoiceConversionStatus(
  apiKey: string | null,
  predictionId: string,
): Promise<VoiceConversionResult> {
  if (MOCK_VOICE_CONVERSION) {
    return mockCheckStatus(predictionId)
  }

  if (!apiKey) {
    throw new Error('Replicate API key is required to check status')
  }

  return replicateCheckStatus(apiKey, predictionId)
}

/**
 * Cancel a voice conversion request
 */
export async function cancelVoiceConversion(
  apiKey: string | null,
  predictionId: string,
): Promise<void> {
  if (MOCK_VOICE_CONVERSION) {
    console.log('[MOCK] Canceling voice conversion:', predictionId)
    return
  }

  if (!apiKey) {
    throw new Error('Replicate API key is required to cancel conversion')
  }

  return replicateCancelPrediction(apiKey, predictionId)
}

/**
 * Check if voice conversion service is available (mock mode or real API)
 */
export function isVoiceConversionServiceAvailable(): boolean {
  return true // Always available - either mock or real
}

/**
 * Check if we're in mock mode
 */
export function isVoiceConversionMockMode(): boolean {
  return MOCK_VOICE_CONVERSION
}
