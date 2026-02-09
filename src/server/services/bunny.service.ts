/**
 * Bunny.net Storage Service
 *
 * Handles uploading and deleting audio files from Bunny.net Storage.
 * Files are served via Bunny CDN Pull Zone for fast delivery.
 *
 * Supports mock mode for development without API keys.
 */

// ============================================================================
// Configuration
// ============================================================================

const MOCK_BUNNY = process.env.MOCK_BUNNY === 'true'

// Bunny.net Storage API base URL
const BUNNY_STORAGE_BASE = 'https://storage.bunnycdn.com'

// Mock CDN URL for development
const MOCK_CDN_URL = 'https://mock-cdn.b-cdn.net'

// ============================================================================
// Types
// ============================================================================

export interface BunnySettings {
  apiKey: string
  storageZone: string
  pullZone: string
}

export interface UploadResult {
  success: boolean
  cdnUrl?: string
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

// ============================================================================
// Mock Implementation
// ============================================================================

async function mockUploadAudio(filename: string): Promise<UploadResult> {
  console.log('[MOCK] Uploading audio to Bunny.net:', filename)
  // Simulate a small delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  return {
    success: true,
    cdnUrl: `${MOCK_CDN_URL}/${filename}`,
  }
}

async function mockDeleteAudio(filename: string): Promise<DeleteResult> {
  console.log('[MOCK] Deleting audio from Bunny.net:', filename)
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { success: true }
}

// ============================================================================
// Bunny.net Implementation
// ============================================================================

/**
 * Upload audio file to Bunny.net Storage
 *
 * Downloads the audio from the source URL (e.g., fal.ai temp URL)
 * and uploads it to Bunny.net Storage Zone.
 *
 * @param settings - Bunny.net settings (API key, storage zone, pull zone)
 * @param sourceUrl - URL to download the audio from
 * @param filename - Filename to use in storage (e.g., "abc123.mp3")
 */
async function bunnyUploadAudio(
  settings: BunnySettings,
  sourceUrl: string,
  filename: string,
): Promise<UploadResult> {
  try {
    // 1. Download the audio from source URL
    console.log('[Bunny] Downloading audio from:', sourceUrl)
    const audioResponse = await fetch(sourceUrl)

    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`,
      )
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    console.log('[Bunny] Downloaded audio:', {
      status: audioResponse.status,
      size: audioBuffer.byteLength,
      contentType: audioResponse.headers.get('content-type'),
    })

    // 2. Upload to Bunny.net Storage
    const uploadUrl = `${BUNNY_STORAGE_BASE}/${settings.storageZone}/${filename}`
    console.log('[Bunny] Uploading to:', uploadUrl)

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: settings.apiKey,
        'Content-Type': 'audio/mpeg',
      },
      body: audioBuffer,
    })

    console.log(
      '[Bunny] Upload response:',
      uploadResponse.status,
      uploadResponse.statusText,
    )

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(
        `Bunny upload failed: ${uploadResponse.status} ${errorText}`,
      )
    }

    // 3. Construct CDN URL
    const cdnUrl = getBunnyCdnUrl(settings.pullZone, filename)
    console.log('[Bunny] Upload successful, CDN URL:', cdnUrl)

    return {
      success: true,
      cdnUrl,
    }
  } catch (error) {
    console.error('[Bunny] Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Delete audio file from Bunny.net Storage
 *
 * @param settings - Bunny.net settings (API key, storage zone)
 * @param filename - Filename to delete (e.g., "abc123.mp3")
 */
async function bunnyDeleteAudio(
  settings: BunnySettings,
  filename: string,
): Promise<DeleteResult> {
  try {
    const deleteUrl = `${BUNNY_STORAGE_BASE}/${settings.storageZone}/${filename}`
    console.log('[Bunny] Deleting:', deleteUrl)

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        AccessKey: settings.apiKey,
      },
    })

    // 404 is okay - file might already be deleted
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      throw new Error(`Bunny delete failed: ${response.status} ${errorText}`)
    }

    console.log('[Bunny] Delete successful')
    return { success: true }
  } catch (error) {
    console.error('[Bunny] Delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error',
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Construct CDN URL for a file
 */
export function getBunnyCdnUrl(pullZone: string, filename: string): string {
  return `https://${pullZone}.b-cdn.net/${filename}`
}

/**
 * Upload audio to Bunny.net Storage and return CDN URL
 */
export async function uploadAudioToBunny(
  settings: BunnySettings,
  sourceUrl: string,
  filename: string,
): Promise<UploadResult> {
  if (MOCK_BUNNY) {
    return mockUploadAudio(filename)
  }

  return bunnyUploadAudio(settings, sourceUrl, filename)
}

/**
 * Delete audio from Bunny.net Storage
 */
export async function deleteAudioFromBunny(
  settings: BunnySettings,
  filename: string,
): Promise<DeleteResult> {
  if (MOCK_BUNNY) {
    return mockDeleteAudio(filename)
  }

  return bunnyDeleteAudio(settings, filename)
}

/**
 * Upload raw audio buffer to Bunny.net Storage and return CDN URL
 *
 * Unlike uploadAudioToBunny which downloads from a source URL,
 * this function accepts raw binary data directly (e.g., from a microphone recording).
 */
export async function uploadAudioBufferToBunny(
  settings: BunnySettings,
  audioBuffer: ArrayBuffer,
  filename: string,
  contentType: string = 'audio/webm',
): Promise<UploadResult> {
  if (MOCK_BUNNY) {
    return mockUploadAudio(filename)
  }

  try {
    const uploadUrl = `${BUNNY_STORAGE_BASE}/${settings.storageZone}/${filename}`
    console.log(
      '[Bunny] Uploading buffer to:',
      uploadUrl,
      'size:',
      audioBuffer.byteLength,
    )

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: settings.apiKey,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(
        `Bunny upload failed: ${uploadResponse.status} ${errorText}`,
      )
    }

    const cdnUrl = getBunnyCdnUrl(settings.pullZone, filename)
    console.log('[Bunny] Buffer upload successful, CDN URL:', cdnUrl)

    return {
      success: true,
      cdnUrl,
    }
  } catch (error) {
    console.error('[Bunny] Buffer upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Check if Bunny service is in mock mode
 */
export function isBunnyMockMode(): boolean {
  return MOCK_BUNNY
}

/**
 * Generate filename for a generation
 */
export function getAudioFilename(generationId: string): string {
  return `${generationId}.mp3`
}
