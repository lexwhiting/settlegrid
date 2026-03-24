/**
 * settlegrid-email-validate — Email Validator MCP Server
 *
 * Validate email addresses via Abstract API.
 *
 * Methods:
 *   validate(email)               — Validate an email address  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ValidateInput {
  email: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://emailvalidation.abstractapi.com/v1'
const API_KEY = process.env.ABSTRACT_EMAIL_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-email-validate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email Validator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'email-validate',
  pricing: {
    defaultCostCents: 2,
    methods: {
      validate: { costCents: 2, displayName: 'Validate Email' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const validate = sg.wrap(async (args: ValidateInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.trim()
  const data = await apiFetch<any>(`/?email=${encodeURIComponent(email)}&api_key=${API_KEY}`)
  return {
    email: data.email,
    deliverability: data.deliverability,
    is_valid_format: data.is_valid_format,
    is_disposable_email: data.is_disposable_email,
    is_free_email: data.is_free_email,
  }
}, { method: 'validate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { validate }

console.log('settlegrid-email-validate MCP server ready')
console.log('Methods: validate')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
