/**
 * Voice Server Functions
 *
 * Handles voice cloning and voice conversion operations.
 * Supports both fal.ai (cloning) and Replicate (conversion) APIs.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { decrypt } from './services/encryption.server'
import {
  checkVoiceCloneStatus,
  submitMiniMaxVoiceClone,
  submitQwenVoiceClone,
  uploadAudioToFalStorage,
} from './services/voice-clone.service'
import {
  checkVoiceConversionStatus,
  getAmphionSingers,
  submitAmphionSVCConversion,
  submitRVCConversion,
} from './services/voice-conversion.service'
import {
  createAudioZipBuffer,
  submitRvcTraining,
  checkRvcTrainingStatus,
} from './services/rvc-training.service'
import {
  uploadAudioToBunny,
  uploadAudioBufferToBunny,
  deleteAudioFromBunny,
} from './services/bunny.service'
import type { VoiceCloneProvider } from './services/voice-clone.service'
import type { AmphionSingerName } from './services/voice-conversion.service'
import type { BunnySettings } from './services/bunny.service'
import { prisma } from '@/db'

// ============================================================================
// Schemas
// ============================================================================

const createVoiceCloneSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  provider: z.enum(['minimax', 'qwen']),
  audioUrl: z.string().url('Valid audio URL is required'),
  // MiniMax-specific
  noiseReduction: z.boolean().optional(),
  volumeNormalization: z.boolean().optional(),
  previewText: z.string().max(500).optional(),
  // Qwen-specific
  referenceText: z.string().max(1000).optional(),
})

const checkVoiceCloneStatusSchema = z.object({
  cloneId: z.string(),
})

const deleteVoiceCloneSchema = z.object({
  cloneId: z.string(),
})

const startVoiceConversionSchema = z.object({
  provider: z.enum(['amphion-svc', 'rvc-v2']),
  sourceGenerationId: z.string(),
  // Amphion SVC
  targetSinger: z.string().optional(),
  // RVC v2
  rvcModelUrl: z.string().url().optional(),
  rvcModelName: z.string().max(100).optional(),
  // Common settings
  pitchShift: z.number().min(-12).max(12).optional(),
  title: z.string().max(200).optional(),
})

const checkVoiceConversionStatusSchema = z.object({
  conversionId: z.string(),
})

const uploadVoiceConversionToCdnSchema = z.object({
  conversionId: z.string(),
})

const deleteVoiceConversionSchema = z.object({
  conversionId: z.string(),
})

const uploadRecordedAudioSchema = z.object({
  audioBase64: z.string().min(1, 'Audio data is required'),
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().default('audio/webm'),
})

const trainRvcModelSchema = z.object({
  voiceCloneId: z.string(),
})

const checkRvcTrainingStatusSchema = z.object({
  voiceCloneId: z.string(),
})

const startConversionWithCloneSchema = z.object({
  voiceCloneId: z.string(),
  sourceGenerationId: z.string(),
  pitchShift: z.number().min(-12).max(12).optional(),
  title: z.string().max(200).optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserFalApiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { falApiKey: true },
  })

  if (!user?.falApiKey) {
    return null
  }

  return decrypt(user.falApiKey)
}

async function getUserReplicateApiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { replicateApiKey: true },
  })

  if (!user?.replicateApiKey) {
    return null
  }

  return decrypt(user.replicateApiKey)
}

async function getUserBunnySettings(
  userId: string,
): Promise<BunnySettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bunnyApiKey: true,
      bunnyStorageZone: true,
      bunnyPullZone: true,
    },
  })

  if (!user?.bunnyApiKey || !user.bunnyStorageZone || !user.bunnyPullZone) {
    return null
  }

  return {
    apiKey: decrypt(user.bunnyApiKey),
    storageZone: user.bunnyStorageZone,
    pullZone: user.bunnyPullZone,
  }
}

// ============================================================================
// Voice Clone Functions
// ============================================================================

/**
 * Create a new voice clone
 */
export const createVoiceCloneFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createVoiceCloneSchema)
  .handler(async ({ data, context }) => {
    const falApiKey = await getUserFalApiKey(context.user.id)

    // Submit to appropriate provider
    let requestId: string

    if (data.provider === 'minimax') {
      const result = await submitMiniMaxVoiceClone(falApiKey, {
        audioUrl: data.audioUrl,
        noiseReduction: data.noiseReduction,
        volumeNormalization: data.volumeNormalization,
        previewText: data.previewText,
      })
      requestId = result.requestId
    } else {
      const result = await submitQwenVoiceClone(falApiKey, {
        audioUrl: data.audioUrl,
        referenceText: data.referenceText,
      })
      requestId = result.requestId
    }

    // Create database record
    const voiceClone = await prisma.voiceClone.create({
      data: {
        userId: context.user.id,
        name: data.name,
        description: data.description,
        provider: data.provider,
        sourceAudioUrl: data.audioUrl,
        referenceText: data.referenceText,
        requestId,
        status: 'processing',
      },
    })

    return {
      id: voiceClone.id,
      requestId,
      status: 'processing',
    }
  })

/**
 * Check voice clone status and update database
 */
export const checkVoiceCloneStatusFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkVoiceCloneStatusSchema)
  .handler(async ({ data, context }) => {
    const voiceClone = await prisma.voiceClone.findFirst({
      where: {
        id: data.cloneId,
        userId: context.user.id,
      },
    })

    if (!voiceClone) {
      throw new Error('Voice clone not found')
    }

    // If already completed or failed, return current status
    if (voiceClone.status === 'ready' || voiceClone.status === 'failed') {
      return {
        id: voiceClone.id,
        status: voiceClone.status,
        minimaxVoiceId: voiceClone.minimaxVoiceId,
        speakerEmbeddingUrl: voiceClone.speakerEmbeddingUrl,
        previewAudioUrl: voiceClone.previewAudioUrl,
        error: voiceClone.error,
      }
    }

    const falApiKey = await getUserFalApiKey(context.user.id)
    const bunnySettings = await getUserBunnySettings(context.user.id)

    // Check status with provider
    const result = await checkVoiceCloneStatus(
      falApiKey,
      voiceClone.provider as VoiceCloneProvider,
      voiceClone.requestId!,
    )

    // Update database based on result
    if (result.status === 'COMPLETED') {
      // Optionally upload to Bunny CDN if configured
      let storedEmbeddingUrl = result.speakerEmbeddingUrl
      let audioStored = false

      if (bunnySettings && result.speakerEmbeddingUrl) {
        try {
          const filename = `voice-embeddings/${voiceClone.id}.safetensors`
          const uploadResult = await uploadAudioToBunny(
            bunnySettings,
            result.speakerEmbeddingUrl,
            filename,
          )
          if (uploadResult.success && uploadResult.cdnUrl) {
            storedEmbeddingUrl = uploadResult.cdnUrl
            audioStored = true
          }
        } catch (err) {
          console.error('Failed to upload embedding to CDN:', err)
          // Keep using fal.ai URL
        }
      }

      await prisma.voiceClone.update({
        where: { id: voiceClone.id },
        data: {
          status: 'ready',
          minimaxVoiceId: result.minimaxVoiceId,
          speakerEmbeddingUrl: storedEmbeddingUrl,
          previewAudioUrl: result.previewAudioUrl,
          sourceAudioStored: audioStored,
        },
      })

      return {
        id: voiceClone.id,
        status: 'ready',
        minimaxVoiceId: result.minimaxVoiceId,
        speakerEmbeddingUrl: storedEmbeddingUrl,
        previewAudioUrl: result.previewAudioUrl,
      }
    } else if (result.status === 'FAILED') {
      await prisma.voiceClone.update({
        where: { id: voiceClone.id },
        data: {
          status: 'failed',
          error: result.error || 'Voice cloning failed',
        },
      })

      return {
        id: voiceClone.id,
        status: 'failed',
        error: result.error || 'Voice cloning failed',
      }
    }

    // Still processing
    return {
      id: voiceClone.id,
      status: 'processing',
      logs: result.logs,
    }
  })

/**
 * List user's voice clones
 */
export const listVoiceClonesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const voiceClones = await prisma.voiceClone.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return voiceClones
  })

/**
 * Delete a voice clone
 */
export const deleteVoiceCloneFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteVoiceCloneSchema)
  .handler(async ({ data, context }) => {
    const voiceClone = await prisma.voiceClone.findFirst({
      where: {
        id: data.cloneId,
        userId: context.user.id,
      },
    })

    if (!voiceClone) {
      throw new Error('Voice clone not found')
    }

    // Clean up CDN files if stored there
    const bunnySettings = await getUserBunnySettings(context.user.id)
    if (bunnySettings) {
      const filesToDelete: string[] = []

      // Speaker embedding file
      if (voiceClone.sourceAudioStored && voiceClone.speakerEmbeddingUrl) {
        filesToDelete.push(`voice-embeddings/${voiceClone.id}.safetensors`)
      }

      // RVC model file
      if (voiceClone.rvcModelUrl?.includes('.b-cdn.net/')) {
        filesToDelete.push(`rvc-models/${voiceClone.id}.zip`)
      }

      // RVC dataset zip
      filesToDelete.push(`rvc-datasets/${voiceClone.id}.zip`)

      // Source recording (if uploaded via microphone)
      // These have dynamic names, extract from URL if it's a CDN URL
      if (
        voiceClone.sourceAudioUrl?.includes('.b-cdn.net/') &&
        voiceClone.sourceAudioUrl.includes('voice-recordings/')
      ) {
        const urlPath = new URL(voiceClone.sourceAudioUrl).pathname
        // Remove leading slash
        filesToDelete.push(urlPath.startsWith('/') ? urlPath.slice(1) : urlPath)
      }

      // Delete all CDN files (best-effort, don't fail the delete operation)
      await Promise.allSettled(
        filesToDelete.map((f) => deleteAudioFromBunny(bunnySettings, f)),
      )
    }

    await prisma.voiceClone.delete({
      where: { id: data.cloneId },
    })

    return { success: true }
  })

/**
 * Upload recorded audio to storage (Bunny CDN if configured, fal.ai as fallback)
 *
 * Accepts base64-encoded audio data from the browser's MediaRecorder,
 * uploads it to the best available storage, and returns a URL that can
 * be used as the audioUrl for voice cloning.
 */
export const uploadRecordedAudioFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(uploadRecordedAudioSchema)
  .handler(async ({ data, context }) => {
    // Decode base64 audio to a Buffer
    const audioBuffer = Buffer.from(data.audioBase64, 'base64')

    if (audioBuffer.byteLength === 0) {
      throw new Error('Audio data is empty')
    }

    // Determine file extension from content type
    const extMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
    }
    const ext = extMap[data.contentType] || 'webm'
    const filename = `voice-recordings/${context.user.id}-${Date.now()}.${ext}`

    // Try Bunny CDN first if configured
    const bunnySettings = await getUserBunnySettings(context.user.id)

    if (bunnySettings) {
      try {
        const result = await uploadAudioBufferToBunny(
          bunnySettings,
          audioBuffer.buffer.slice(
            audioBuffer.byteOffset,
            audioBuffer.byteOffset + audioBuffer.byteLength,
          ),
          filename,
          data.contentType,
        )

        if (result.success && result.cdnUrl) {
          return { url: result.cdnUrl, storage: 'bunny' as const }
        }
        console.error(
          'Bunny upload failed, falling back to fal.ai:',
          result.error,
        )
      } catch (err) {
        console.error('Bunny upload error, falling back to fal.ai:', err)
      }
    }

    // Fallback to fal.ai storage
    const falApiKey = await getUserFalApiKey(context.user.id)

    if (!falApiKey) {
      throw new Error(
        'No storage available. Configure Bunny CDN or add a fal.ai API key.',
      )
    }

    const url = await uploadAudioToFalStorage(
      falApiKey,
      audioBuffer,
      data.filename,
      data.contentType,
    )

    return { url, storage: 'fal' as const }
  })

// ============================================================================
// RVC Training Functions
// ============================================================================

/**
 * Train an RVC v2 model from a voice clone's source audio.
 *
 * Automatically:
 * 1. Downloads the source audio
 * 2. Packages it into a .zip
 * 3. Uploads the .zip to storage (Bunny CDN or fal.ai)
 * 4. Submits to replicate/train-rvc-model for training
 * 5. Updates the voice clone record with training status
 */
export const trainRvcModelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(trainRvcModelSchema)
  .handler(async ({ data, context }) => {
    // Get the voice clone
    const voiceClone = await prisma.voiceClone.findFirst({
      where: {
        id: data.voiceCloneId,
        userId: context.user.id,
        status: 'ready',
      },
    })

    if (!voiceClone) {
      throw new Error('Voice clone not found or not ready')
    }

    if (voiceClone.rvcModelStatus === 'training') {
      throw new Error('RVC training is already in progress')
    }

    if (voiceClone.rvcModelStatus === 'ready' && voiceClone.rvcModelUrl) {
      throw new Error('RVC model is already trained')
    }

    // Check for Replicate API key
    const replicateApiKey = await getUserReplicateApiKey(context.user.id)
    if (!replicateApiKey) {
      throw new Error(
        'Replicate API key is required for RVC training. Add it in Settings.',
      )
    }

    // Step 1: Create .zip from source audio
    const zipBuffer = await createAudioZipBuffer(voiceClone.sourceAudioUrl)

    // Step 2: Upload .zip to storage
    const bunnySettings = await getUserBunnySettings(context.user.id)
    let zipUrl: string

    if (bunnySettings) {
      try {
        const filename = `rvc-datasets/${voiceClone.id}.zip`
        const arrayBuf = new Uint8Array(zipBuffer).buffer as ArrayBuffer
        const result = await uploadAudioBufferToBunny(
          bunnySettings,
          arrayBuf,
          filename,
          'application/zip',
        )
        if (result.success && result.cdnUrl) {
          zipUrl = result.cdnUrl
        } else {
          throw new Error(result.error || 'Bunny upload failed')
        }
      } catch (err) {
        // Fallback to fal.ai storage
        console.error(
          'Bunny upload failed for zip, falling back to fal.ai:',
          err,
        )
        const falApiKey = await getUserFalApiKey(context.user.id)
        if (!falApiKey) {
          throw new Error('No storage available for dataset upload.')
        }
        const { uploadAudioToFalStorage } =
          await import('./services/voice-clone.service')
        zipUrl = await uploadAudioToFalStorage(
          falApiKey,
          zipBuffer,
          `rvc-dataset-${voiceClone.id}.zip`,
          'application/zip',
        )
      }
    } else {
      // Use fal.ai storage
      const falApiKey = await getUserFalApiKey(context.user.id)
      if (!falApiKey) {
        throw new Error(
          'No storage available. Configure Bunny CDN or add a fal.ai API key.',
        )
      }
      const { uploadAudioToFalStorage } =
        await import('./services/voice-clone.service')
      zipUrl = await uploadAudioToFalStorage(
        falApiKey,
        zipBuffer,
        `rvc-dataset-${voiceClone.id}.zip`,
        'application/zip',
      )
    }

    // Step 3: Submit to Replicate for training
    const result = await submitRvcTraining(replicateApiKey, {
      datasetZipUrl: zipUrl,
    })

    // Step 4: Update database
    await prisma.voiceClone.update({
      where: { id: voiceClone.id },
      data: {
        rvcModelStatus: 'training',
        rvcRequestId: result.predictionId,
        rvcError: null,
      },
    })

    return {
      id: voiceClone.id,
      rvcModelStatus: 'training',
      rvcRequestId: result.predictionId,
    }
  })

/**
 * Check RVC training status and update database
 */
export const checkRvcTrainingStatusFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkRvcTrainingStatusSchema)
  .handler(async ({ data, context }) => {
    const voiceClone = await prisma.voiceClone.findFirst({
      where: {
        id: data.voiceCloneId,
        userId: context.user.id,
      },
    })

    if (!voiceClone) {
      throw new Error('Voice clone not found')
    }

    // If already completed or failed, return current status
    if (
      voiceClone.rvcModelStatus === 'ready' ||
      voiceClone.rvcModelStatus === 'failed'
    ) {
      return {
        id: voiceClone.id,
        rvcModelStatus: voiceClone.rvcModelStatus,
        rvcModelUrl: voiceClone.rvcModelUrl,
        rvcError: voiceClone.rvcError,
      }
    }

    if (!voiceClone.rvcRequestId) {
      return {
        id: voiceClone.id,
        rvcModelStatus: voiceClone.rvcModelStatus,
      }
    }

    const replicateApiKey = await getUserReplicateApiKey(context.user.id)
    const result = await checkRvcTrainingStatus(
      replicateApiKey,
      voiceClone.rvcRequestId,
    )

    if (result.status === 'succeeded' && result.outputUrl) {
      // Optionally upload trained model to Bunny CDN
      let storedModelUrl = result.outputUrl
      const bunnySettings = await getUserBunnySettings(context.user.id)

      if (bunnySettings) {
        try {
          const filename = `rvc-models/${voiceClone.id}.zip`
          const uploadResult = await uploadAudioToBunny(
            bunnySettings,
            result.outputUrl,
            filename,
          )
          if (uploadResult.success && uploadResult.cdnUrl) {
            storedModelUrl = uploadResult.cdnUrl
          }
        } catch (err) {
          console.error('Failed to upload RVC model to CDN:', err)
        }
      }

      await prisma.voiceClone.update({
        where: { id: voiceClone.id },
        data: {
          rvcModelStatus: 'ready',
          rvcModelUrl: storedModelUrl,
          rvcError: null,
        },
      })

      return {
        id: voiceClone.id,
        rvcModelStatus: 'ready',
        rvcModelUrl: storedModelUrl,
      }
    } else if (result.status === 'failed') {
      await prisma.voiceClone.update({
        where: { id: voiceClone.id },
        data: {
          rvcModelStatus: 'failed',
          rvcError: result.error || 'RVC training failed',
        },
      })

      return {
        id: voiceClone.id,
        rvcModelStatus: 'failed',
        rvcError: result.error || 'RVC training failed',
      }
    }

    // Still training
    return {
      id: voiceClone.id,
      rvcModelStatus: 'training',
      progress: result.progress,
    }
  })

/**
 * Start a voice conversion using a trained voice clone's RVC model
 */
export const startConversionWithCloneFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(startConversionWithCloneSchema)
  .handler(async ({ data, context }) => {
    // Get the voice clone with its trained RVC model
    const voiceClone = await prisma.voiceClone.findFirst({
      where: {
        id: data.voiceCloneId,
        userId: context.user.id,
        rvcModelStatus: 'ready',
      },
    })

    if (!voiceClone || !voiceClone.rvcModelUrl) {
      throw new Error('Voice clone not found or RVC model not trained')
    }

    // Get the source music generation
    const sourceGeneration = await prisma.musicGeneration.findFirst({
      where: {
        id: data.sourceGenerationId,
        userId: context.user.id,
        status: 'completed',
      },
    })

    if (!sourceGeneration || !sourceGeneration.audioUrl) {
      throw new Error('Source track not found or not completed')
    }

    const replicateApiKey = await getUserReplicateApiKey(context.user.id)

    // Submit to RVC v2 with the clone's trained model
    const result = await submitRVCConversion(replicateApiKey, {
      sourceAudioUrl: sourceGeneration.audioUrl,
      rvcModelUrl: voiceClone.rvcModelUrl,
      pitchShift: data.pitchShift,
    })

    // Generate title
    const title =
      data.title || `${sourceGeneration.title || 'Track'} - ${voiceClone.name}`

    // Create database record
    const voiceConversion = await prisma.voiceConversion.create({
      data: {
        userId: context.user.id,
        provider: 'rvc-v2',
        sourceAudioUrl: sourceGeneration.audioUrl,
        sourceType: 'voice-clone',
        sourceGenerationId: data.sourceGenerationId,
        sourceVoiceCloneId: data.voiceCloneId,
        rvcModelUrl: voiceClone.rvcModelUrl,
        rvcModelName: voiceClone.name,
        pitchShift: data.pitchShift,
        requestId: result.predictionId,
        status: 'processing',
        title,
      },
    })

    return {
      id: voiceConversion.id,
      predictionId: result.predictionId,
      status: 'processing',
    }
  })

/**
 * List user's completed music generations (for track selection in Convert Track dialog)
 */
export const listCompletedGenerationsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const generations = await prisma.musicGeneration.findMany({
      where: {
        userId: context.user.id,
        status: 'completed',
        audioUrl: { not: null },
      },
      select: {
        id: true,
        title: true,
        prompt: true,
        audioUrl: true,
        audioDurationMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return generations
  })

// ============================================================================
// Voice Conversion Functions
// ============================================================================

/**
 * Get available preset singers for Amphion SVC
 */
export const getPresetSingersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getAmphionSingers()
  },
)

/**
 * Start a voice conversion
 */
export const startVoiceConversionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(startVoiceConversionSchema)
  .handler(async ({ data, context }) => {
    // Get source generation
    const sourceGeneration = await prisma.musicGeneration.findFirst({
      where: {
        id: data.sourceGenerationId,
        userId: context.user.id,
        status: 'completed',
      },
    })

    if (!sourceGeneration || !sourceGeneration.audioUrl) {
      throw new Error('Source track not found or not completed')
    }

    const replicateApiKey = await getUserReplicateApiKey(context.user.id)

    // Validate provider-specific requirements
    if (data.provider === 'amphion-svc' && !data.targetSinger) {
      throw new Error('Target singer is required for Amphion SVC')
    }

    if (data.provider === 'rvc-v2' && !data.rvcModelUrl) {
      throw new Error('RVC model URL is required for RVC v2')
    }

    // Submit to appropriate provider
    let predictionId: string

    if (data.provider === 'amphion-svc') {
      const result = await submitAmphionSVCConversion(replicateApiKey, {
        sourceAudioUrl: sourceGeneration.audioUrl,
        targetSinger: data.targetSinger as AmphionSingerName,
      })
      predictionId = result.predictionId
    } else {
      const result = await submitRVCConversion(replicateApiKey, {
        sourceAudioUrl: sourceGeneration.audioUrl,
        rvcModelUrl: data.rvcModelUrl!,
        pitchShift: data.pitchShift,
      })
      predictionId = result.predictionId
    }

    // Generate title
    const title =
      data.title ||
      `${sourceGeneration.title || 'Track'} - ${data.targetSinger || data.rvcModelName || 'Voice Conversion'}`

    // Create database record
    const voiceConversion = await prisma.voiceConversion.create({
      data: {
        userId: context.user.id,
        provider: data.provider,
        sourceAudioUrl: sourceGeneration.audioUrl,
        sourceType: 'generation',
        sourceGenerationId: data.sourceGenerationId,
        targetSinger: data.targetSinger,
        rvcModelUrl: data.rvcModelUrl,
        rvcModelName: data.rvcModelName,
        pitchShift: data.pitchShift,
        requestId: predictionId,
        status: 'processing',
        title,
      },
    })

    return {
      id: voiceConversion.id,
      predictionId,
      status: 'processing',
    }
  })

/**
 * Check voice conversion status and update database
 */
export const checkVoiceConversionStatusFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkVoiceConversionStatusSchema)
  .handler(async ({ data, context }) => {
    const voiceConversion = await prisma.voiceConversion.findFirst({
      where: {
        id: data.conversionId,
        userId: context.user.id,
      },
    })

    if (!voiceConversion) {
      throw new Error('Voice conversion not found')
    }

    // If already completed or failed, return current status
    if (
      voiceConversion.status === 'completed' ||
      voiceConversion.status === 'failed'
    ) {
      return {
        id: voiceConversion.id,
        status: voiceConversion.status,
        outputAudioUrl: voiceConversion.outputAudioUrl,
        error: voiceConversion.error,
        progress: voiceConversion.progress,
      }
    }

    const replicateApiKey = await getUserReplicateApiKey(context.user.id)
    const bunnySettings = await getUserBunnySettings(context.user.id)

    // Check status with Replicate
    const result = await checkVoiceConversionStatus(
      replicateApiKey,
      voiceConversion.requestId!,
    )

    // Update database based on result
    if (result.status === 'succeeded') {
      // Optionally upload to Bunny CDN if configured
      let storedAudioUrl = result.outputAudioUrl
      let audioStored = false

      if (bunnySettings && result.outputAudioUrl) {
        try {
          const filename = `voice-conversions/${voiceConversion.id}.mp3`
          const uploadResult = await uploadAudioToBunny(
            bunnySettings,
            result.outputAudioUrl,
            filename,
          )
          if (uploadResult.success && uploadResult.cdnUrl) {
            storedAudioUrl = uploadResult.cdnUrl
            audioStored = true
          }
        } catch (err) {
          console.error('Failed to upload conversion to CDN:', err)
          // Keep using Replicate URL
        }
      }

      await prisma.voiceConversion.update({
        where: { id: voiceConversion.id },
        data: {
          status: 'completed',
          outputAudioUrl: storedAudioUrl,
          outputAudioStored: audioStored,
          progress: 100,
        },
      })

      return {
        id: voiceConversion.id,
        status: 'completed',
        outputAudioUrl: storedAudioUrl,
        progress: 100,
      }
    } else if (result.status === 'failed') {
      await prisma.voiceConversion.update({
        where: { id: voiceConversion.id },
        data: {
          status: 'failed',
          error: result.error || 'Conversion failed',
        },
      })

      return {
        id: voiceConversion.id,
        status: 'failed',
        error: result.error || 'Conversion failed',
      }
    }

    // Still processing - update progress
    await prisma.voiceConversion.update({
      where: { id: voiceConversion.id },
      data: {
        progress: result.progress || 0,
      },
    })

    return {
      id: voiceConversion.id,
      status: 'processing',
      progress: result.progress || 0,
      logs: result.logs,
    }
  })

/**
 * List user's voice conversions
 */
export const listVoiceConversionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const voiceConversions = await prisma.voiceConversion.findMany({
      where: { userId: context.user.id },
      include: {
        sourceGeneration: {
          select: {
            id: true,
            title: true,
            prompt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return voiceConversions
  })

/**
 * Upload voice conversion to CDN
 */
export const uploadVoiceConversionToCdnFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(uploadVoiceConversionToCdnSchema)
  .handler(async ({ data, context }) => {
    const voiceConversion = await prisma.voiceConversion.findFirst({
      where: {
        id: data.conversionId,
        userId: context.user.id,
        status: 'completed',
      },
    })

    if (!voiceConversion || !voiceConversion.outputAudioUrl) {
      throw new Error('Conversion not found or not completed')
    }

    if (voiceConversion.outputAudioStored) {
      throw new Error('Already stored on CDN')
    }

    const bunnySettings = await getUserBunnySettings(context.user.id)

    if (!bunnySettings) {
      throw new Error('Bunny.net settings not configured')
    }

    const filename = `voice-conversions/${voiceConversion.id}.mp3`
    const uploadResult = await uploadAudioToBunny(
      bunnySettings,
      voiceConversion.outputAudioUrl,
      filename,
    )

    if (!uploadResult.success || !uploadResult.cdnUrl) {
      throw new Error(uploadResult.error || 'Failed to upload to CDN')
    }

    await prisma.voiceConversion.update({
      where: { id: voiceConversion.id },
      data: {
        outputAudioUrl: uploadResult.cdnUrl,
        outputAudioStored: true,
      },
    })

    return {
      success: true,
      audioUrl: uploadResult.cdnUrl,
    }
  })

/**
 * Delete a voice conversion
 */
export const deleteVoiceConversionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteVoiceConversionSchema)
  .handler(async ({ data, context }) => {
    const voiceConversion = await prisma.voiceConversion.findFirst({
      where: {
        id: data.conversionId,
        userId: context.user.id,
      },
    })

    if (!voiceConversion) {
      throw new Error('Voice conversion not found')
    }

    // Clean up CDN files if stored there
    if (voiceConversion.outputAudioStored && voiceConversion.outputAudioUrl) {
      const bunnySettings = await getUserBunnySettings(context.user.id)
      if (bunnySettings) {
        const filename = `voice-conversions/${voiceConversion.id}.mp3`
        await deleteAudioFromBunny(bunnySettings, filename).catch((err) =>
          console.error('Failed to delete conversion from CDN:', err),
        )
      }
    }

    await prisma.voiceConversion.delete({
      where: { id: data.conversionId },
    })

    return { success: true }
  })
