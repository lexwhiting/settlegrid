/**
 * SettleGrid Service Template: Image Generator
 *
 * Wraps an image generation API (e.g., DALL-E, Stable Diffusion, Replicate)
 * with per-image billing through SettleGrid. Callers submit a text prompt
 * and receive a generated image URL.
 *
 * Pricing: $0.10 per image generated (configurable)
 *
 * Usage:
 *   1. `npm install settlegrid openai`
 *   2. Set SETTLEGRID_SECRET and OPENAI_API_KEY in your environment
 *   3. Deploy and register on SettleGrid dashboard
 */

import { SettleGrid } from 'settlegrid'
import OpenAI from 'openai'

// ─── Initialize ─────────────────────────────────────────────────────────────

const sg = new SettleGrid({
  secret: process.env.SETTLEGRID_SECRET!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImageRequest {
  prompt: string
  size?: '256x256' | '512x512' | '1024x1024'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number
}

interface GeneratedImage {
  url: string
  revisedPrompt: string
}

interface ImageResponse {
  images: GeneratedImage[]
  model: string
  size: string
  generatedAt: string
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleImageGeneration(input: ImageRequest): Promise<ImageResponse> {
  const prompt = input.prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('prompt is required')
  }

  const size = input.size ?? '1024x1024'
  const quality = input.quality ?? 'standard'
  const style = input.style ?? 'vivid'
  const n = Math.min(Math.max(input.n ?? 1, 1), 4) // 1-4 images

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt.slice(0, 4000), // DALL-E 3 prompt limit
    size,
    quality,
    style,
    n,
  })

  const images: GeneratedImage[] = (response.data ?? []).map((img) => ({
    url: img.url ?? '',
    revisedPrompt: img.revised_prompt ?? prompt,
  }))

  return {
    images,
    model: 'dall-e-3',
    size,
    generatedAt: new Date().toISOString(),
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-image, and records usage on the SettleGrid ledger.
 *
 * Note: Billing is per-image, not per-request. A request generating 3
 * images is charged 3x the per-image rate.
 */
export default sg.wrap(handleImageGeneration, {
  name: 'image-generator',
  pricing: {
    model: 'per-unit',
    costCentsPerUnit: 10, // $0.10 per image
    // Unit count is derived from the number of images in the response
    unitCountField: 'images.length',
  },
  rateLimit: {
    requests: 10,
    window: '1m',
  },
})
