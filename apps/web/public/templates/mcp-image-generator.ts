#!/usr/bin/env npx tsx
/**
 * MCP Image Generator — Monetized with SettleGrid
 *
 * A complete MCP server that wraps OpenAI DALL-E 3 for image generation
 * with per-image billing via SettleGrid.
 *
 * Setup:
 *   1. npm install @settlegrid/mcp
 *   2. Set OPENAI_API_KEY and SETTLEGRID_API_KEY in your env
 *   3. Register your tool at settlegrid.ai/dashboard/tools
 *   4. Run: npx tsx mcp-image-generator.ts
 *
 * Pricing: 8 cents per standard image, 15 cents per HD image
 *   - DALL-E 3 Standard 1024x1024 costs $0.04/image
 *   - DALL-E 3 HD 1024x1792 costs $0.08/image
 *   - 8 cents standard = 2x margin, 15 cents HD = ~1.9x margin
 *   - Lower margin but high volume potential for creative tools
 *
 * Revenue: You keep 95-100% (100% on Free tier, 95% on paid tiers)
 */

import { settlegrid } from '@settlegrid/mcp'

// ── SettleGrid Setup ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'my-image-gen', // Replace with your tool slug
  pricing: {
    defaultCostCents: 8,
    methods: {
      generate: { costCents: 8, displayName: 'Generate Image' },
      'generate-hd': { costCents: 15, displayName: 'Generate HD Image' },
      variation: { costCents: 8, displayName: 'Image Variation' },
    },
  },
})

// ── OpenAI Image Generation ─────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations'

type ImageSize = '1024x1024' | '1024x1792' | '1792x1024'

interface GenerateArgs {
  prompt: string
  size?: ImageSize
  style?: 'vivid' | 'natural'
}

interface ImageResult {
  url: string
  revisedPrompt: string
  size: string
}

async function generateImage(
  prompt: string,
  quality: 'standard' | 'hd',
  size: ImageSize,
  style: 'vivid' | 'natural'
): Promise<ImageResult> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      style,
      response_format: 'url',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const message = (error as { error?: { message?: string } }).error?.message ?? response.statusText
    throw new Error(`OpenAI API error: ${message}`)
  }

  const data = await response.json()
  const image = data.data?.[0]
  if (!image) {
    throw new Error('No image returned from OpenAI')
  }

  return {
    url: image.url,
    revisedPrompt: image.revised_prompt ?? prompt,
    size,
  }
}

// ── Prompt Safety ───────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 4000

function validatePrompt(prompt: string): void {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt must be a non-empty string')
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`)
  }
}

const VALID_SIZES: ImageSize[] = ['1024x1024', '1024x1792', '1792x1024']

function validateSize(size: string | undefined): ImageSize {
  if (!size) return '1024x1024'
  if (!VALID_SIZES.includes(size as ImageSize)) {
    throw new Error(`Invalid size "${size}". Must be one of: ${VALID_SIZES.join(', ')}`)
  }
  return size as ImageSize
}

// ── Tool Methods ────────────────────────────────────────────────────────────

async function handleGenerate(args: GenerateArgs): Promise<ImageResult> {
  validatePrompt(args.prompt)
  const size = validateSize(args.size)
  return generateImage(args.prompt, 'standard', size, args.style ?? 'vivid')
}

async function handleGenerateHD(args: GenerateArgs): Promise<ImageResult> {
  validatePrompt(args.prompt)
  const size = validateSize(args.size)
  return generateImage(args.prompt, 'hd', size, args.style ?? 'vivid')
}

interface VariationArgs {
  prompt: string
  referenceDescription: string
  size?: ImageSize
}

async function handleVariation(args: VariationArgs): Promise<ImageResult> {
  validatePrompt(args.prompt)
  if (!args.referenceDescription || args.referenceDescription.trim().length === 0) {
    throw new Error('Reference description must be non-empty')
  }

  const size = validateSize(args.size)
  const combinedPrompt = `Create a variation of the following concept: ${args.referenceDescription}\n\nWith these modifications: ${args.prompt}`
  return generateImage(combinedPrompt, 'standard', size, 'vivid')
}

// ── Wrap with SettleGrid Billing ─────────────────────────────────────────────

export const billedGenerate = sg.wrap(handleGenerate, { method: 'generate' })
export const billedGenerateHD = sg.wrap(handleGenerateHD, { method: 'generate-hd' })
export const billedVariation = sg.wrap(handleVariation, { method: 'variation' })

// ── REST Alternative ────────────────────────────────────────────────────────
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
//
// const withBilling = settlegridMiddleware({
//   toolSlug: 'my-image-gen',
//   pricing: {
//     defaultCostCents: 8,
//     methods: {
//       generate: { costCents: 8 },
//       'generate-hd': { costCents: 15 },
//       variation: { costCents: 8 },
//     },
//   },
// })
//
// export async function POST(request: Request) {
//   return withBilling(request, async () => {
//     const body = await request.json()
//     const result = await handleGenerate(body)
//     return Response.json(result)
//   }, 'generate')
// }
