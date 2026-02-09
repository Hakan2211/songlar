/**
 * Music Generation Server Functions
 *
 * Handles music generation requests, status polling, and track management.
 * Stores generation history in the database.
 *
 * Supports 3 providers:
 * - elevenlabs: ElevenLabs Music via fal.ai
 * - minimax-v2: MiniMax v2 via fal.ai
 * - minimax-v2.5: MiniMax v2.5 via direct API
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { decrypt } from './services/encryption.server'
import {
  cancelMusicGeneration,
  checkMusicGenerationStatus,
  isMockMode,
  isQueueBasedProvider,
  submitMusicGeneration,
} from './services/music.service'
import {
  generateMusicWithMiniMax,
  isMiniMaxMockMode,
} from './services/minimax.service'
import {
  deleteAudioFromBunny,
  getAudioFilename,
  uploadAudioToBunny,
} from './services/bunny.service'
import type { MusicProvider } from './services/music.service'
import type { BunnySettings } from './services/bunny.service'
import { prisma } from '@/db'

// ============================================================================
// Schemas
// ============================================================================

const audioSettingsSchema = z.object({
  sampleRate: z.enum(['16000', '24000', '32000', '44100']).optional(),
  bitrate: z.enum(['32000', '64000', '128000', '256000']).optional(),
  format: z.enum(['mp3', 'wav', 'pcm', 'flac']).optional(),
})

const generateMusicSchema = z.object({
  provider: z.enum(['elevenlabs', 'minimax-v2', 'minimax-v2.5']),
  prompt: z.string().optional(),
  lyrics: z.string().optional(),
  durationMs: z.number().min(3000).max(600000).optional(),
  forceInstrumental: z.boolean().optional(),
  title: z.string().optional(),
  audioSettings: audioSettingsSchema.optional(),
})

const checkStatusSchema = z.object({
  generationId: z.string(),
})

const cancelGenerationSchema = z.object({
  generationId: z.string(),
})

const listGenerationsSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  favoritesOnly: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
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

async function getUserMiniMaxApiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { minimaxApiKey: true },
  })

  if (!user?.minimaxApiKey) {
    return null
  }

  return decrypt(user.minimaxApiKey)
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

function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case 'elevenlabs':
      return 'ElevenLabs'
    case 'minimax-v2':
      return 'MiniMax v2'
    case 'minimax-v2.5':
      return 'MiniMax v2.5'
    default:
      return provider
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Check if the current user has platform access (paid)
 * In mock payment mode, always returns true for development
 */
export const checkPlatformAccessFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const mockPayments = process.env.MOCK_PAYMENTS === 'true'
    if (mockPayments) {
      return { hasAccess: true, mock: true }
    }

    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { hasPlatformAccess: true },
    })

    return { hasAccess: user?.hasPlatformAccess ?? false, mock: false }
  })

/**
 * Start a new music generation
 */
export const generateMusicFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateMusicSchema)
  .handler(async ({ data, context }) => {
    // Check platform access (skip in mock payment mode)
    const mockPayments = process.env.MOCK_PAYMENTS === 'true'
    if (!mockPayments) {
      const user = await prisma.user.findUnique({
        where: { id: context.user.id },
        select: { hasPlatformAccess: true },
      })

      if (!user?.hasPlatformAccess) {
        throw new Error(
          'Platform access required. Please purchase access to generate music.',
        )
      }
    }

    const {
      provider,
      prompt,
      lyrics,
      durationMs,
      forceInstrumental,
      title,
      audioSettings,
    } = data

    // Validate provider-specific requirements
    switch (provider) {
      case 'elevenlabs':
        if (!prompt || prompt.trim().length < 10) {
          throw new Error(
            'ElevenLabs requires a prompt of at least 10 characters',
          )
        }
        if (prompt.length > 300) {
          throw new Error('ElevenLabs prompt must be 300 characters or less')
        }
        break
      case 'minimax-v2':
        if (!prompt || prompt.trim().length < 10) {
          throw new Error(
            'MiniMax v2 requires a style prompt of at least 10 characters',
          )
        }
        if (prompt.length > 300) {
          throw new Error('MiniMax v2 prompt must be 300 characters or less')
        }
        if (!lyrics || lyrics.trim().length < 10) {
          throw new Error(
            'MiniMax v2 requires lyrics of at least 10 characters',
          )
        }
        if (lyrics.length > 3000) {
          throw new Error('MiniMax v2 lyrics must be 3000 characters or less')
        }
        break
      case 'minimax-v2.5':
        if (!lyrics || lyrics.trim().length < 1) {
          throw new Error('MiniMax v2.5 requires lyrics')
        }
        if (lyrics.length > 3500) {
          throw new Error('MiniMax v2.5 lyrics must be 3500 characters or less')
        }
        if (prompt && prompt.length > 2000) {
          throw new Error('MiniMax v2.5 prompt must be 2000 characters or less')
        }
        break
    }

    // Handle MiniMax v2.5 separately (direct API, synchronous)
    if (provider === 'minimax-v2.5') {
      const apiKey = isMiniMaxMockMode()
        ? null
        : await getUserMiniMaxApiKey(context.user.id)

      if (!isMiniMaxMockMode() && !apiKey) {
        throw new Error(
          'Please add your MiniMax API key in Settings before using MiniMax v2.5',
        )
      }

      // Create database record first
      const generation = await prisma.musicGeneration.create({
        data: {
          userId: context.user.id,
          provider,
          prompt: prompt || '',
          lyrics,
          durationMs,
          status: 'processing', // MiniMax v2.5 is synchronous, starts immediately
          title:
            title ||
            `${getProviderDisplayName(provider)} - ${new Date().toLocaleDateString()}`,
        },
      })

      try {
        // Build audio settings for MiniMax v2.5
        const minimaxAudioSettings = audioSettings
          ? {
              sampleRate: audioSettings.sampleRate
                ? (parseInt(audioSettings.sampleRate, 10) as
                    | 16000
                    | 24000
                    | 32000
                    | 44100)
                : undefined,
              bitrate: audioSettings.bitrate
                ? (parseInt(audioSettings.bitrate, 10) as
                    | 32000
                    | 64000
                    | 128000
                    | 256000)
                : undefined,
              format: audioSettings.format as 'mp3' | 'wav' | 'pcm' | undefined,
            }
          : undefined

        // Call MiniMax API (this blocks until completion)
        const result = await generateMusicWithMiniMax(apiKey, {
          prompt: prompt || undefined,
          lyrics: lyrics!,
          audioSettings: minimaxAudioSettings,
        })

        if (!result.success) {
          // Update as failed
          await prisma.musicGeneration.update({
            where: { id: generation.id },
            data: {
              status: 'failed',
              error: result.error,
            },
          })

          return {
            generationId: generation.id,
            status: 'failed',
            error: result.error,
          }
        }

        // Try to upload to Bunny.net
        let audioUrl = result.audioUrl
        let audioStored = false
        let originalAudioUrl: string | undefined

        const bunnySettings = await getUserBunnySettings(context.user.id)
        if (bunnySettings && result.audioUrl) {
          const filename = getAudioFilename(generation.id)
          const uploadResult = await uploadAudioToBunny(
            bunnySettings,
            result.audioUrl,
            filename,
          )

          if (uploadResult.success && uploadResult.cdnUrl) {
            originalAudioUrl = result.audioUrl
            audioUrl = uploadResult.cdnUrl
            audioStored = true
          } else {
            console.error(
              '[MusicGeneration] CDN upload failed:',
              uploadResult.error,
              '- audio will use temporary provider URL',
            )
          }
        } else if (!bunnySettings) {
          console.warn(
            '[MusicGeneration] No Bunny CDN settings - audio will use temporary provider URL',
          )
        }

        // Update as completed
        await prisma.musicGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'completed',
            audioUrl,
            originalAudioUrl,
            audioStored,
            audioDurationMs: result.duration,
            progress: 100,
          },
        })

        return {
          generationId: generation.id,
          status: 'completed',
          audioUrl,
        }
      } catch (error) {
        // Update as failed
        await prisma.musicGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Generation failed',
          },
        })

        throw error
      }
    }

    // Handle fal.ai providers (ElevenLabs and MiniMax v2)
    const apiKey = isMockMode() ? null : await getUserFalApiKey(context.user.id)

    if (!isMockMode() && !apiKey) {
      throw new Error(
        'Please add your fal.ai API key in Settings before generating music',
      )
    }

    // Build audio settings for fal.ai (MiniMax v2)
    const falAudioSettings =
      provider === 'minimax-v2' && audioSettings
        ? {
            sampleRate: audioSettings.sampleRate
              ? parseInt(audioSettings.sampleRate, 10)
              : undefined,
            bitrate: audioSettings.bitrate
              ? parseInt(audioSettings.bitrate, 10)
              : undefined,
            format: audioSettings.format,
          }
        : undefined

    // Submit to fal.ai
    const result = await submitMusicGeneration(apiKey, {
      provider: provider,
      prompt: prompt || '',
      lyrics,
      durationMs,
      forceInstrumental,
      audioSettings: falAudioSettings,
    })

    // Store in database
    const generation = await prisma.musicGeneration.create({
      data: {
        userId: context.user.id,
        provider,
        prompt: prompt || '',
        lyrics,
        durationMs,
        status: 'pending',
        requestId: result.requestId,
        title:
          title ||
          `${getProviderDisplayName(provider)} - ${new Date().toLocaleDateString()}`,
      },
    })

    return {
      generationId: generation.id,
      requestId: result.requestId,
      status: 'pending',
    }
  })

/**
 * Check the status of a music generation (fal.ai providers only)
 */
export const checkGenerationStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(checkStatusSchema)
  .handler(async ({ data, context }) => {
    const { generationId } = data

    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    // If already completed or failed, return stored status
    if (generation.status === 'completed' || generation.status === 'failed') {
      return {
        generationId: generation.id,
        status: generation.status,
        audioUrl: generation.audioUrl,
        audioStored: generation.audioStored,
        error: generation.error,
        progress: generation.progress,
      }
    }

    // MiniMax v2.5 is synchronous - if still processing, just return current state
    if (generation.provider === 'minimax-v2.5') {
      return {
        generationId: generation.id,
        status: generation.status,
        progress: 50, // Indeterminate progress
      }
    }

    // Check with fal.ai for queue-based providers
    const apiKey = isMockMode() ? null : await getUserFalApiKey(context.user.id)

    if (!isMockMode() && !apiKey) {
      throw new Error('fal.ai API key not found')
    }

    if (!generation.requestId) {
      throw new Error('Generation request ID not found')
    }

    const result = await checkMusicGenerationStatus(
      apiKey,
      generation.provider as MusicProvider,
      generation.requestId,
    )

    // Map fal.ai status to our status
    let dbStatus: string = generation.status
    if (result.status === 'COMPLETED') {
      dbStatus = 'completed'
    } else if (result.status === 'FAILED') {
      dbStatus = 'failed'
    } else if (result.status === 'IN_PROGRESS') {
      dbStatus = 'processing'
    }

    // Prepare update data
    const updateData: {
      status: string
      audioUrl?: string
      originalAudioUrl?: string
      audioStored?: boolean
      error?: string
      progress: number
    } = {
      status: dbStatus,
      audioUrl: result.audioUrl,
      error: result.error,
      progress: result.progress || 0,
    }

    // If completed with audio URL, try to upload to Bunny.net
    let uploadError: string | undefined
    if (result.status === 'COMPLETED' && result.audioUrl) {
      const bunnySettings = await getUserBunnySettings(context.user.id)

      if (bunnySettings) {
        const filename = getAudioFilename(generation.id)
        const uploadResult = await uploadAudioToBunny(
          bunnySettings,
          result.audioUrl,
          filename,
        )

        if (uploadResult.success && uploadResult.cdnUrl) {
          updateData.originalAudioUrl = result.audioUrl
          updateData.audioUrl = uploadResult.cdnUrl
          updateData.audioStored = true
        } else {
          uploadError = uploadResult.error
          updateData.audioStored = false
          console.error('[Music] Bunny upload failed:', uploadResult.error)
        }
      }
    }

    // Update database
    await prisma.musicGeneration.update({
      where: { id: generationId },
      data: updateData,
    })

    return {
      generationId: generation.id,
      status: dbStatus,
      audioUrl: updateData.audioUrl,
      audioStored: updateData.audioStored || false,
      error: result.error,
      uploadError,
      progress: result.progress || 0,
      logs: result.logs,
    }
  })

/**
 * Cancel a music generation
 */
export const cancelGenerationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(cancelGenerationSchema)
  .handler(async ({ data, context }) => {
    const { generationId } = data

    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    if (generation.status !== 'pending' && generation.status !== 'processing') {
      throw new Error('Cannot cancel a completed or failed generation')
    }

    // Only fal.ai providers support cancellation
    if (
      isQueueBasedProvider(generation.provider as MusicProvider) &&
      generation.requestId
    ) {
      const apiKey = isMockMode()
        ? null
        : await getUserFalApiKey(context.user.id)
      await cancelMusicGeneration(
        apiKey,
        generation.provider as MusicProvider,
        generation.requestId,
      )
    }

    await prisma.musicGeneration.update({
      where: { id: generationId },
      data: {
        status: 'failed',
        error: 'Cancelled by user',
      },
    })

    return { success: true }
  })

/**
 * List user's music generations
 */
export const listGenerationsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listGenerationsSchema)
  .handler(async ({ data, context }) => {
    const { status, favoritesOnly, limit = 50, offset = 0 } = data

    const where: {
      userId: string
      status?: string
      isFavorite?: boolean
    } = {
      userId: context.user.id,
    }

    if (status) {
      where.status = status
    }

    if (favoritesOnly) {
      where.isFavorite = true
    }

    const [generations, total] = await Promise.all([
      prisma.musicGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          voiceConversions: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              provider: true,
              outputAudioUrl: true,
              outputAudioStored: true,
              targetSinger: true,
              rvcModelName: true,
              pitchShift: true,
              title: true,
              error: true,
              progress: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.musicGeneration.count({ where }),
    ])

    return {
      generations,
      total,
      limit,
      offset,
    }
  })

/**
 * Get a single generation by ID
 */
export const getGenerationFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ generationId: z.string() }))
  .handler(async ({ data, context }) => {
    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    return generation
  })

/**
 * Delete a generation (and its audio from CDN if stored)
 */
export const deleteGenerationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ generationId: z.string() }))
  .handler(async ({ data, context }) => {
    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    // If stored on Bunny.net, try to delete the file
    if (generation.audioStored) {
      const bunnySettings = await getUserBunnySettings(context.user.id)

      if (bunnySettings) {
        const filename = getAudioFilename(generation.id)
        const deleteResult = await deleteAudioFromBunny(bunnySettings, filename)

        if (!deleteResult.success) {
          console.warn(
            '[Music] Failed to delete from Bunny:',
            deleteResult.error,
          )
        }
      }
    }

    await prisma.musicGeneration.delete({
      where: { id: data.generationId },
    })

    return { success: true }
  })

/**
 * Update generation title
 */
export const updateGenerationTitleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      generationId: z.string(),
      title: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    await prisma.musicGeneration.update({
      where: { id: data.generationId },
      data: { title: data.title },
    })

    return { success: true }
  })

/**
 * Toggle favorite status for a generation
 */
export const toggleFavoriteFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ generationId: z.string() }))
  .handler(async ({ data, context }) => {
    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Generation not found')
    }

    const updated = await prisma.musicGeneration.update({
      where: { id: data.generationId },
      data: { isFavorite: !generation.isFavorite },
    })

    return {
      success: true,
      isFavorite: updated.isFavorite,
    }
  })

/**
 * Get active (pending/processing) generations for polling
 */
export const getActiveGenerationsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const generations = await prisma.musicGeneration.findMany({
      where: {
        userId: context.user.id,
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return generations
  })

/**
 * Manually upload a completed track to Bunny.net CDN
 */
export const uploadToCdnFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ generationId: z.string() }))
  .handler(async ({ data, context }) => {
    const generation = await prisma.musicGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: context.user.id,
      },
    })

    if (!generation) {
      throw new Error('Track not found')
    }

    if (generation.status !== 'completed') {
      throw new Error('Track must be completed before uploading to CDN')
    }

    if (generation.audioStored) {
      throw new Error('Track is already stored on CDN')
    }

    const sourceUrl = generation.originalAudioUrl || generation.audioUrl
    if (!sourceUrl) {
      throw new Error('No audio URL available to upload')
    }

    const bunnySettings = await getUserBunnySettings(context.user.id)
    if (!bunnySettings) {
      throw new Error('Please configure Bunny.net settings first')
    }

    const filename = getAudioFilename(generation.id)
    const uploadResult = await uploadAudioToBunny(
      bunnySettings,
      sourceUrl,
      filename,
    )

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed')
    }

    await prisma.musicGeneration.update({
      where: { id: generation.id },
      data: {
        originalAudioUrl: generation.originalAudioUrl || generation.audioUrl,
        audioUrl: uploadResult.cdnUrl,
        audioStored: true,
      },
    })

    return {
      success: true,
      cdnUrl: uploadResult.cdnUrl,
    }
  })
