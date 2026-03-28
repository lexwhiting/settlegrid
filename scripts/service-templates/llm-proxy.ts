/**
 * SettleGrid Service Template: LLM Proxy
 *
 * Wraps OpenAI chat completions with per-token billing through SettleGrid.
 * Callers pay per 1K tokens (input + output) without needing their own
 * OpenAI key. The developer earns a margin on each request.
 *
 * Pricing: $0.003 per 1K tokens (configurable via SettleGrid dashboard)
 *
 * Usage:
 *   1. `npm install settlegrid openai`
 *   2. Set SETTLEGRID_SECRET and OPENAI_API_KEY in your environment
 *   3. Deploy to Vercel / Railway / any Node.js host
 *   4. Register the endpoint URL on your SettleGrid dashboard
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

interface LlmRequest {
  model?: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  max_tokens?: number
}

interface LlmResponse {
  content: string
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleChatCompletion(input: LlmRequest): Promise<LlmResponse> {
  const model = input.model ?? 'gpt-4o-mini'
  const maxTokens = Math.min(input.max_tokens ?? 2048, 4096)

  const completion = await openai.chat.completions.create({
    model,
    messages: input.messages,
    temperature: input.temperature ?? 0.7,
    max_tokens: maxTokens,
  })

  const choice = completion.choices[0]
  const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  return {
    content: choice?.message?.content ?? '',
    model: completion.model,
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    },
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-token, and records usage on the SettleGrid ledger.
 */
export default sg.wrap(handleChatCompletion, {
  name: 'llm-proxy',
  pricing: {
    model: 'per-token',
    costPer1kTokens: 0.3, // cents per 1K tokens
    // Usage is metered from the response's `usage.total_tokens` field
    usageField: 'usage.total_tokens',
  },
  rateLimit: {
    requests: 60,
    window: '1m',
  },
})
