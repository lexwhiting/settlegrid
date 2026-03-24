/**
 * settlegrid-dalle — DALL-E Image Generation MCP Server
 *
 * Generate images from text prompts via OpenAI DALL-E.
 *
 * Methods:
 *   generate_image(prompt, size)  — Generate an image from a text prompt  (5¢)
 *   create_variation(image_url, size) — Create a variation of an existing image  (5¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateImageInput {
  prompt: string
  size?: string
}

interface CreateVariationInput {
  image_url: string
  size?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openai.com/v1/images'
const API_KEY = process.env.OPENAI_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-dalle/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DALL-E Image Generation API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dalle',
  pricing: {
    defaultCostCents: 5,
    methods: {
      generate_image: { costCents: 5, displayName: 'Generate Image' },
      create_variation: { costCents: 5, displayName: 'Create Variation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generateImage = sg.wrap(async (args: GenerateImageInput) => {
  if (!args.prompt || typeof args.prompt !== 'string') throw new Error('prompt is required')
  const prompt = args.prompt.trim()
  const size = typeof args.size === 'string' ? args.size.trim() : ''
  const data = await apiFetch<any>(`/generations`)
  const items = (data.data ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        url: item.url,
        revised_prompt: item.revised_prompt,
    })),
  }
}, { method: 'generate_image' })

const createVariation = sg.wrap(async (args: CreateVariationInput) => {
  if (!args.image_url || typeof args.image_url !== 'string') throw new Error('image_url is required')
  const image_url = args.image_url.trim()
  const size = typeof args.size === 'string' ? args.size.trim() : ''
  const data = await apiFetch<any>(`/variations`)
  const items = (data.data ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        url: item.url,
    })),
  }
}, { method: 'create_variation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generateImage, createVariation }

console.log('settlegrid-dalle MCP server ready')
console.log('Methods: generate_image, create_variation')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')
