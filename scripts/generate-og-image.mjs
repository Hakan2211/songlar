/**
 * Generate OG Image for Social Media Previews
 *
 * Creates a 1200x630 PNG with the Songlar logo, title, and tagline.
 * Used for Twitter cards, WhatsApp previews, Facebook shares, etc.
 *
 * Usage:
 *   npm run generate-og
 *   node scripts/generate-og-image.mjs
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'og-image.png')

// ============================================================================
// Config
// ============================================================================

const WIDTH = 1200
const HEIGHT = 630

// Colors (matching the app's dark theme with primary accent)
const BG_COLOR_TOP = '#09090b' // zinc-950
const BG_COLOR_BOTTOM = '#18181b' // zinc-900
const PRIMARY = '#60a5fa' // blue-400 (primary brand color)
const PRIMARY_DARK = '#2563eb' // blue-600
const TEXT_WHITE = '#fafafa' // zinc-50
const TEXT_MUTED = '#a1a1aa' // zinc-400

// Try to register Inter font from Google Fonts CDN (downloaded to temp)
// Fall back to system sans-serif if not available
const FONT_FAMILY = 'Inter, Segoe UI, Arial, sans-serif'

// ============================================================================
// Download & Register Inter Font
// ============================================================================

async function registerInterFont() {
  try {
    // Download Inter Bold and Regular from Google Fonts static files
    const fonts = [
      {
        url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf',
        name: 'Inter-Regular',
      },
      {
        url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf',
        name: 'Inter-Bold',
      },
    ]

    for (const font of fonts) {
      console.log(`  Downloading ${font.name}...`)
      const response = await fetch(font.url)
      if (!response.ok) throw new Error(`Failed to download ${font.name}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      GlobalFonts.register(buffer, 'Inter')
    }

    console.log('  Inter font registered successfully')
    return true
  } catch (err) {
    console.warn(
      '  Could not download Inter font, using system fallback:',
      err.message,
    )
    return false
  }
}

// ============================================================================
// Drawing Helpers
// ============================================================================

function drawBackground(ctx) {
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, BG_COLOR_TOP)
  gradient.addColorStop(1, BG_COLOR_BOTTOM)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Subtle radial glow behind center content
  const radial = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2 - 40,
    0,
    WIDTH / 2,
    HEIGHT / 2 - 40,
    350,
  )
  radial.addColorStop(0, 'rgba(96, 165, 250, 0.08)')
  radial.addColorStop(1, 'rgba(96, 165, 250, 0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

function drawLogo(ctx, cx, cy, size) {
  // Rounded rectangle background with gradient
  const logoSize = size
  const x = cx - logoSize / 2
  const y = cy - logoSize / 2
  const radius = logoSize * 0.2

  // Background
  const logoGrad = ctx.createLinearGradient(x, y, x + logoSize, y + logoSize)
  logoGrad.addColorStop(0, PRIMARY)
  logoGrad.addColorStop(1, PRIMARY_DARK)

  ctx.beginPath()
  ctx.roundRect(x, y, logoSize, logoSize, radius)
  ctx.fillStyle = logoGrad
  ctx.fill()

  // Shadow
  ctx.shadowColor = 'rgba(96, 165, 250, 0.3)'
  ctx.shadowBlur = 30
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // Music note icon (matching Logo.tsx SVG paths, scaled to fit)
  const scale = logoSize / 40
  const ox = cx - 12 * scale
  const oy = cy - 12 * scale

  ctx.strokeStyle = TEXT_WHITE
  ctx.lineWidth = 2 * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Path: M9 18V5l12-2v13 (the stem and beam)
  ctx.beginPath()
  ctx.moveTo(ox + 9 * scale, oy + 18 * scale)
  ctx.lineTo(ox + 9 * scale, oy + 5 * scale)
  ctx.lineTo(ox + 21 * scale, oy + 3 * scale)
  ctx.lineTo(ox + 21 * scale, oy + 16 * scale)
  ctx.stroke()

  // Circle at (6, 18) r=3 (left note head)
  ctx.beginPath()
  ctx.arc(ox + 6 * scale, oy + 18 * scale, 3 * scale, 0, Math.PI * 2)
  ctx.stroke()

  // Circle at (18, 16) r=3 (right note head)
  ctx.beginPath()
  ctx.arc(ox + 18 * scale, oy + 16 * scale, 3 * scale, 0, Math.PI * 2)
  ctx.stroke()
}

function drawText(ctx, text, x, y, font, color, align = 'center') {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function drawDecoWaveform(ctx, cx, y, barCount, barWidth, maxHeight, color) {
  // Decorative waveform bars (like the ones on the landing page)
  const gap = barWidth + 3
  const totalWidth = barCount * gap - 3
  const startX = cx - totalWidth / 2

  for (let i = 0; i < barCount; i++) {
    const t = i / (barCount - 1)
    const height = Math.sin(t * Math.PI) * maxHeight * 0.7 + maxHeight * 0.3
    const bx = startX + i * gap
    const by = y - height / 2

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(bx, by, barWidth, height, barWidth / 2)
    ctx.fill()
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Generating OG image...')

  await registerInterFont()

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // 1. Background
  drawBackground(ctx)

  // 2. Decorative waveform bars (top-left and bottom-right, very subtle)
  drawDecoWaveform(ctx, 200, 100, 20, 3, 40, 'rgba(96, 165, 250, 0.06)')
  drawDecoWaveform(ctx, 1000, 530, 20, 3, 40, 'rgba(96, 165, 250, 0.06)')

  // 3. Logo (centered, upper area)
  const centerX = WIDTH / 2
  drawLogo(ctx, centerX, 220, 90)

  // 4. Title: "Songlar"
  drawText(ctx, 'Songlar', centerX, 320, `bold 64px ${FONT_FAMILY}`, TEXT_WHITE)

  // 5. Tagline: "Create Music with AI"
  drawText(
    ctx,
    'Create Music with AI',
    centerX,
    385,
    `500 30px ${FONT_FAMILY}`,
    TEXT_MUTED,
  )

  // 6. Subtle bottom accent line
  const lineGrad = ctx.createLinearGradient(
    WIDTH / 2 - 100,
    0,
    WIDTH / 2 + 100,
    0,
  )
  lineGrad.addColorStop(0, 'rgba(96, 165, 250, 0)')
  lineGrad.addColorStop(0.5, 'rgba(96, 165, 250, 0.4)')
  lineGrad.addColorStop(1, 'rgba(96, 165, 250, 0)')
  ctx.fillStyle = lineGrad
  ctx.fillRect(WIDTH / 2 - 100, 430, 200, 2)

  // 7. Domain text at bottom
  drawText(
    ctx,
    'songlar.com',
    centerX,
    490,
    `400 20px ${FONT_FAMILY}`,
    'rgba(161, 161, 170, 0.5)',
  )

  // Save
  const buffer = canvas.toBuffer('image/png')
  writeFileSync(OUTPUT_PATH, buffer)

  const sizeMB = (buffer.byteLength / 1024).toFixed(1)
  console.log(`\nOG image saved: ${OUTPUT_PATH} (${sizeMB} KB)`)
  console.log(`Dimensions: ${WIDTH}x${HEIGHT}`)
}

main().catch((err) => {
  console.error('Failed to generate OG image:', err)
  process.exit(1)
})
