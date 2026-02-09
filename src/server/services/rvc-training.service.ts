/**
 * RVC Training Service
 *
 * Handles training custom RVC v2 voice models from audio samples.
 * Uses Replicate's `replicate/train-rvc-model` model.
 *
 * Flow:
 * 1. Download source audio from URL
 * 2. Package into a .zip file (required by the training model)
 * 3. Upload .zip to storage (Bunny CDN or fal.ai)
 * 4. Submit to Replicate for training (~13 minutes)
 * 5. Poll for completion and return the trained model URL
 *
 * Supports mock mode for development without API keys.
 */

import Replicate from 'replicate'
import archiver from 'archiver'
import { Readable } from 'stream'

// ============================================================================
// Configuration
// ============================================================================

const MOCK_RVC_TRAINING = process.env.MOCK_RVC_TRAINING === 'true'

// Replicate model for RVC training
// Note: Must use full version hash for POST /v1/predictions endpoint
const RVC_TRAINING_MODEL_VERSION =
  'replicate/train-rvc-model:0397d5e28c9b54665e1e5d29d5cf4f722a7b89ec20e9dbf31487235305b1a101' as const

// Default training parameters
const DEFAULT_TRAINING_OPTIONS = {
  sample_rate: '48k',
  version: 'v2',
  f0method: 'rmvpe_gpu',
  epoch: 50,
  batch_size: '7',
} as const

// ============================================================================
// Types
// ============================================================================

export interface RvcTrainingInput {
  datasetZipUrl: string
  sampleRate?: '32k' | '40k' | '48k'
  version?: 'v1' | 'v2'
  f0method?: 'pm' | 'harvest' | 'crepe' | 'rmvpe' | 'rmvpe_gpu'
  epoch?: number
  batchSize?: number
}

export interface RvcTrainingResult {
  predictionId: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  outputUrl?: string // URL to the trained RVC model .zip
  error?: string
  progress?: number
  logs?: string
}

export interface RvcTrainingSubmitResult {
  predictionId: string
}

// ============================================================================
// Mock Implementation
// ============================================================================

function createMockPredictionId(): string {
  return `mock-rvc-train-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function mockSubmitTraining(
  _input: RvcTrainingInput,
): Promise<RvcTrainingSubmitResult> {
  console.log('[MOCK] RVC training submitted')
  return {
    predictionId: createMockPredictionId(),
  }
}

async function mockCheckTrainingStatus(
  predictionId: string,
): Promise<RvcTrainingResult> {
  console.log('[MOCK] Checking RVC training status for:', predictionId)

  const mockStartTime = parseInt(predictionId.split('-')[3] || '0', 10)
  const elapsed = Date.now() - mockStartTime

  if (elapsed < 3000) {
    return {
      predictionId,
      status: 'starting',
      progress: 0,
    }
  } else if (elapsed < 8000) {
    const progress = Math.min(90, Math.floor((elapsed - 3000) / 55))
    return {
      predictionId,
      status: 'processing',
      progress,
      logs: 'Training RVC model...',
    }
  } else {
    return {
      predictionId,
      status: 'succeeded',
      outputUrl: `https://replicate.delivery/mock/rvc-model-${Date.now()}.zip`,
      progress: 100,
    }
  }
}

// ============================================================================
// Zip Utilities
// ============================================================================

/**
 * Download audio from a URL and package it into a .zip buffer.
 *
 * The RVC training model expects a .zip containing audio files.
 * We download the source audio and zip it with a clean filename.
 */
export async function createAudioZipBuffer(audioUrl: string): Promise<Buffer> {
  console.log('[RVC Training] Downloading audio from:', audioUrl)

  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download audio: ${response.status} ${response.statusText}`,
    )
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  console.log('[RVC Training] Downloaded audio, size:', audioBuffer.byteLength)

  // Create .zip with the audio file
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    const archive = archiver('zip', { zlib: { level: 5 } })

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on('end', () => {
      const zipBuffer = Buffer.concat(chunks)
      console.log('[RVC Training] Created zip, size:', zipBuffer.byteLength)
      resolve(zipBuffer)
    })

    archive.on('error', (err: Error) => {
      reject(new Error(`Failed to create zip: ${err.message}`))
    })

    // Add the audio file to the zip in the structure expected by the RVC training model:
    // dataset/<rvc_name>/split_<i>.wav
    const rvcName = 'voice-clone'
    const audioStream = Readable.from(audioBuffer)
    archive.append(audioStream, { name: `dataset/${rvcName}/split_0.wav` })

    archive.finalize()
  })
}

// ============================================================================
// Replicate Implementation
// ============================================================================

function createReplicateClient(apiKey: string): Replicate {
  return new Replicate({
    auth: apiKey,
  })
}

/**
 * Submit an RVC training job to Replicate
 */
async function replicateSubmitTraining(
  apiKey: string,
  input: RvcTrainingInput,
): Promise<RvcTrainingSubmitResult> {
  const replicate = createReplicateClient(apiKey)

  const replicateInput: Record<string, unknown> = {
    dataset_zip: input.datasetZipUrl,
    sample_rate: input.sampleRate || DEFAULT_TRAINING_OPTIONS.sample_rate,
    version: input.version || DEFAULT_TRAINING_OPTIONS.version,
    f0method: input.f0method || DEFAULT_TRAINING_OPTIONS.f0method,
    epoch: input.epoch || DEFAULT_TRAINING_OPTIONS.epoch,
    batch_size: String(input.batchSize || DEFAULT_TRAINING_OPTIONS.batch_size),
  }

  console.log('[RVC Training] Submitting to Replicate:', {
    version: RVC_TRAINING_MODEL_VERSION,
    dataset_zip: input.datasetZipUrl,
    epoch: replicateInput.epoch,
  })

  const prediction = await replicate.predictions.create({
    version: RVC_TRAINING_MODEL_VERSION,
    input: replicateInput,
  })

  return {
    predictionId: prediction.id,
  }
}

/**
 * Check training status from Replicate
 */
async function replicateCheckTrainingStatus(
  apiKey: string,
  predictionId: string,
): Promise<RvcTrainingResult> {
  const replicate = createReplicateClient(apiKey)

  const prediction = await replicate.predictions.get(predictionId)

  const result: RvcTrainingResult = {
    predictionId,
    status: prediction.status as RvcTrainingResult['status'],
    logs: typeof prediction.logs === 'string' ? prediction.logs : undefined,
  }

  if (prediction.status === 'succeeded') {
    // Output is the URL to the trained model .zip
    if (typeof prediction.output === 'string') {
      result.outputUrl = prediction.output
    } else if (
      Array.isArray(prediction.output) &&
      prediction.output.length > 0
    ) {
      result.outputUrl = prediction.output[0] as string
    }
    result.progress = 100
  } else if (prediction.status === 'failed') {
    result.error =
      typeof prediction.error === 'string'
        ? prediction.error
        : 'RVC training failed'
  } else if (prediction.status === 'processing') {
    // Estimate progress from logs if available
    if (result.logs) {
      const epochMatch = result.logs.match(/Epoch (\d+)/)
      if (epochMatch) {
        const currentEpoch = parseInt(epochMatch[1], 10)
        result.progress = Math.min(
          95,
          Math.floor((currentEpoch / DEFAULT_TRAINING_OPTIONS.epoch) * 100),
        )
      }
    }
  }

  return result
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Submit an RVC model training job
 */
export async function submitRvcTraining(
  apiKey: string | null,
  input: RvcTrainingInput,
): Promise<RvcTrainingSubmitResult> {
  if (MOCK_RVC_TRAINING) {
    return mockSubmitTraining(input)
  }

  if (!apiKey) {
    throw new Error('Replicate API key is required for RVC training')
  }

  return replicateSubmitTraining(apiKey, input)
}

/**
 * Check the status of an RVC training job
 */
export async function checkRvcTrainingStatus(
  apiKey: string | null,
  predictionId: string,
): Promise<RvcTrainingResult> {
  if (MOCK_RVC_TRAINING) {
    return mockCheckTrainingStatus(predictionId)
  }

  if (!apiKey) {
    throw new Error('Replicate API key is required to check training status')
  }

  return replicateCheckTrainingStatus(apiKey, predictionId)
}

/**
 * Check if we're in mock mode
 */
export function isRvcTrainingMockMode(): boolean {
  return MOCK_RVC_TRAINING
}
