/**
 * Encryption Service
 *
 * AES-256-GCM encryption for sensitive data like API keys.
 * Uses Node.js crypto module - SERVER ONLY.
 *
 * The encryption key is derived from BETTER_AUTH_SECRET using PBKDF2.
 * This ensures we don't need a separate encryption key env var.
 */

import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'node:crypto'

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits
const KEY_LENGTH = 32 // 256 bits for AES-256
const ITERATIONS = 100000 // PBKDF2 iterations

/**
 * Derive encryption key from BETTER_AUTH_SECRET
 * Uses PBKDF2 with SHA-512 for key derivation
 */
function deriveKey(salt: Buffer): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is not configured')
  }

  return pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512')
}

/**
 * Encrypt a plaintext string
 * Returns base64-encoded string: salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)

  // Derive key from secret
  const key = deriveKey(salt)

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Get auth tag for integrity verification
  const authTag = cipher.getAuthTag()

  // Combine all parts: salt:iv:authTag:ciphertext
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':')
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded string: salt:iv:authTag:ciphertext
 */
export function decrypt(encryptedData: string): string {
  // Split the combined string
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const [saltB64, ivB64, authTagB64, ciphertext] = parts

  // Decode from base64
  const salt = Buffer.from(saltB64, 'base64')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')

  // Derive key from secret using the same salt
  const key = deriveKey(salt)

  // Create decipher and decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Get the last N characters of a string for display purposes
 * Returns "...xxxx" format
 */
export function getLastFourChars(str: string, chars = 4): string {
  if (str.length <= chars) {
    return '...' + str
  }
  return '...' + str.slice(-chars)
}

/**
 * Validate that an API key looks valid (basic format check)
 * Different providers have different formats
 */
export function validateApiKeyFormat(
  key: string,
  provider: 'fal' | 'minimax',
): boolean {
  // Remove any whitespace
  const trimmed = key.trim()

  if (trimmed.length === 0) {
    return false
  }

  // fal.ai keys are typically UUIDs or similar
  // MiniMax keys have their own format
  // For now, just check minimum length
  const minLength = provider === 'fal' ? 10 : 10

  return trimmed.length >= minLength
}
