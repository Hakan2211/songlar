/**
 * BYOK (Bring Your Own Key) Server Functions
 *
 * Handles encrypted storage and retrieval of user API keys.
 * Keys are encrypted using AES-256-GCM before storage.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import {
  decrypt,
  encrypt,
  getLastFourChars,
  validateApiKeyFormat,
} from './services/encryption.server'
import { prisma } from '@/db'

// ============================================================================
// Types
// ============================================================================

export type ApiKeyProvider = 'fal' | 'minimax' | 'bunny'

export interface ApiKeyStatus {
  provider: ApiKeyProvider
  hasKey: boolean
  lastFour: string | null
  addedAt: Date | null
}

export interface BunnyStatus {
  hasKey: boolean
  lastFour: string | null
  addedAt: Date | null
  storageZone: string | null
  pullZone: string | null
}

// ============================================================================
// Schemas
// ============================================================================

const saveApiKeySchema = z.object({
  provider: z.enum(['fal', 'minimax']),
  apiKey: z.string().min(1, 'API key is required'),
})

const deleteApiKeySchema = z.object({
  provider: z.enum(['fal', 'minimax']),
})

const getDecryptedKeySchema = z.object({
  provider: z.enum(['fal', 'minimax']),
})

const saveBunnySettingsSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  storageZone: z.string().min(1, 'Storage zone is required'),
  pullZone: z.string().min(1, 'Pull zone is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get status of all API keys (without exposing the actual keys)
 */
export const getAllApiKeyStatusesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Array<ApiKeyStatus>> => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        falApiKey: true,
        falApiKeyLastFour: true,
        falApiKeyAddedAt: true,
        minimaxApiKey: true,
        minimaxApiKeyLastFour: true,
        minimaxApiKeyAddedAt: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return [
      {
        provider: 'fal' as const,
        hasKey: !!user.falApiKey,
        lastFour: user.falApiKeyLastFour,
        addedAt: user.falApiKeyAddedAt,
      },
      {
        provider: 'minimax' as const,
        hasKey: !!user.minimaxApiKey,
        lastFour: user.minimaxApiKeyLastFour,
        addedAt: user.minimaxApiKeyAddedAt,
      },
    ]
  })

/**
 * Get Bunny.net settings status
 */
export const getBunnyStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BunnyStatus> => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        bunnyApiKey: true,
        bunnyApiKeyLastFour: true,
        bunnyApiKeyAddedAt: true,
        bunnyStorageZone: true,
        bunnyPullZone: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return {
      hasKey: !!user.bunnyApiKey,
      lastFour: user.bunnyApiKeyLastFour,
      addedAt: user.bunnyApiKeyAddedAt,
      storageZone: user.bunnyStorageZone,
      pullZone: user.bunnyPullZone,
    }
  })

/**
 * Save an API key (encrypts before storing)
 */
export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(saveApiKeySchema)
  .handler(async ({ data, context }) => {
    const { provider, apiKey } = data
    const trimmedKey = apiKey.trim()

    // Validate key format
    if (!validateApiKeyFormat(trimmedKey, provider)) {
      throw new Error(`Invalid ${provider} API key format`)
    }

    // Encrypt the key
    const encryptedKey = encrypt(trimmedKey)
    const lastFour = getLastFourChars(trimmedKey)
    const now = new Date()

    // Update the appropriate fields based on provider
    if (provider === 'fal') {
      await prisma.user.update({
        where: { id: context.user.id },
        data: {
          falApiKey: encryptedKey,
          falApiKeyLastFour: lastFour,
          falApiKeyAddedAt: now,
        },
      })
    } else if (provider === 'minimax') {
      await prisma.user.update({
        where: { id: context.user.id },
        data: {
          minimaxApiKey: encryptedKey,
          minimaxApiKeyLastFour: lastFour,
          minimaxApiKeyAddedAt: now,
        },
      })
    }

    return {
      success: true,
      provider,
      lastFour,
      addedAt: now,
    }
  })

/**
 * Delete an API key
 */
export const deleteApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteApiKeySchema)
  .handler(async ({ data, context }) => {
    const { provider } = data

    // Clear the appropriate fields based on provider
    if (provider === 'fal') {
      await prisma.user.update({
        where: { id: context.user.id },
        data: {
          falApiKey: null,
          falApiKeyLastFour: null,
          falApiKeyAddedAt: null,
        },
      })
    } else if (provider === 'minimax') {
      await prisma.user.update({
        where: { id: context.user.id },
        data: {
          minimaxApiKey: null,
          minimaxApiKeyLastFour: null,
          minimaxApiKeyAddedAt: null,
        },
      })
    }

    return {
      success: true,
      provider,
    }
  })

/**
 * Get decrypted API key for use in services
 * This is an internal function - only call from other server functions
 */
export const getDecryptedApiKeyFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(getDecryptedKeySchema)
  .handler(async ({ data, context }): Promise<string | null> => {
    const { provider } = data

    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        falApiKey: true,
        minimaxApiKey: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    let encryptedKey: string | null = null

    if (provider === 'fal') {
      encryptedKey = user.falApiKey
    } else if (provider === 'minimax') {
      encryptedKey = user.minimaxApiKey
    }

    if (!encryptedKey) {
      return null
    }

    // Decrypt and return
    return decrypt(encryptedKey)
  })

/**
 * Save Bunny.net settings (API key + storage/pull zones)
 */
export const saveBunnySettingsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(saveBunnySettingsSchema)
  .handler(async ({ data, context }) => {
    const { apiKey, storageZone, pullZone } = data
    const trimmedKey = apiKey.trim()
    const trimmedStorageZone = storageZone.trim()
    const trimmedPullZone = pullZone.trim()

    // Encrypt the key
    const encryptedKey = encrypt(trimmedKey)
    const lastFour = getLastFourChars(trimmedKey)
    const now = new Date()

    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        bunnyApiKey: encryptedKey,
        bunnyApiKeyLastFour: lastFour,
        bunnyApiKeyAddedAt: now,
        bunnyStorageZone: trimmedStorageZone,
        bunnyPullZone: trimmedPullZone,
      },
    })

    return {
      success: true,
      lastFour,
      addedAt: now,
      storageZone: trimmedStorageZone,
      pullZone: trimmedPullZone,
    }
  })

/**
 * Delete Bunny.net settings
 */
export const deleteBunnySettingsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        bunnyApiKey: null,
        bunnyApiKeyLastFour: null,
        bunnyApiKeyAddedAt: null,
        bunnyStorageZone: null,
        bunnyPullZone: null,
      },
    })

    return { success: true }
  })

/**
 * Get decrypted Bunny.net settings for use in services
 * This is an internal function - only call from other server functions
 */
export const getDecryptedBunnySettingsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(
    async ({
      context,
    }): Promise<{
      apiKey: string
      storageZone: string
      pullZone: string
    } | null> => {
      const user = await prisma.user.findUnique({
        where: { id: context.user.id },
        select: {
          bunnyApiKey: true,
          bunnyStorageZone: true,
          bunnyPullZone: true,
        },
      })

      if (!user) {
        throw new Error('User not found')
      }

      if (!user.bunnyApiKey || !user.bunnyStorageZone || !user.bunnyPullZone) {
        return null
      }

      return {
        apiKey: decrypt(user.bunnyApiKey),
        storageZone: user.bunnyStorageZone,
        pullZone: user.bunnyPullZone,
      }
    },
  )
