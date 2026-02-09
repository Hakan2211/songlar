/**
 * Audio Utilities
 *
 * Client-side audio format conversion using the Web Audio API.
 * Used to convert browser-recorded WebM/Opus audio to WAV format
 * for compatibility with APIs that only accept WAV/MP3.
 */

/**
 * Convert an audio Blob (any format the browser can decode) to WAV format.
 *
 * Uses the Web Audio API to decode the source audio, then encodes it
 * as 16-bit PCM WAV at the source sample rate.
 *
 * @param blob - Source audio blob (e.g. WebM from MediaRecorder)
 * @param targetSampleRate - Optional target sample rate (defaults to source rate)
 * @returns A new Blob with MIME type audio/wav
 */
export async function blobToWav(
  blob: Blob,
  targetSampleRate?: number,
): Promise<Blob> {
  const audioContext = new AudioContext()

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const sampleRate = targetSampleRate || audioBuffer.sampleRate
    const numberOfChannels = audioBuffer.numberOfChannels

    // If we need to resample, use an OfflineAudioContext
    let finalBuffer: AudioBuffer
    if (targetSampleRate && targetSampleRate !== audioBuffer.sampleRate) {
      const duration = audioBuffer.duration
      const offlineCtx = new OfflineAudioContext(
        numberOfChannels,
        Math.ceil(duration * targetSampleRate),
        targetSampleRate,
      )
      const source = offlineCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineCtx.destination)
      source.start(0)
      finalBuffer = await offlineCtx.startRendering()
    } else {
      finalBuffer = audioBuffer
    }

    const wavBytes = encodeWav(finalBuffer, sampleRate, numberOfChannels)
    return new Blob([wavBytes], { type: 'audio/wav' })
  } finally {
    await audioContext.close()
  }
}

/**
 * Encode an AudioBuffer as a WAV file (16-bit PCM).
 */
function encodeWav(
  audioBuffer: AudioBuffer,
  sampleRate: number,
  numberOfChannels: number,
): ArrayBuffer {
  const length = audioBuffer.length
  const bytesPerSample = 2 // 16-bit
  const dataSize = length * numberOfChannels * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true) // file size - 8
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true) // byte rate
  view.setUint16(32, numberOfChannels * bytesPerSample, true) // block align
  view.setUint16(34, bytesPerSample * 8, true) // bits per sample

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave channels and write 16-bit PCM samples
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }

  let offset = headerSize
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += bytesPerSample
    }
  }

  return buffer
}

/**
 * Write an ASCII string to a DataView at the given offset.
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
