/**
 * settlegrid-contact-form — Contact Form Processing MCP Server
 *
 * Local validation — no external API needed.
 *
 * Methods:
 *   validate_form(fields)    — Validate form fields           (1¢)
 *   format_message(fields)   — Format fields into message     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormFields {
  name?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
  company?: string
  website?: string
}

interface FormInput {
  fields: FormFields
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/
const URL_REGEX = /^https?:\/\/[\w.-]+(?:\.[a-zA-Z]{2,})(?:\/[^\s]*)?$/

const SPAM_PATTERNS = [
  /\b(viagra|cialis|casino|lottery|winner|congratulations|urgent|act now)\b/i,
  /\b(buy now|limited time|click here|free money|guaranteed)\b/i,
  /(.)\1{10,}/, // Repeated characters
  /<\/?[a-z][\s\S]*>/i, // HTML tags
]

interface ValidationError {
  field: string
  message: string
}

function validateFields(fields: FormFields): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  if (!fields.name || fields.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name is required (min 2 characters)' })
  } else if (fields.name.length > 100) {
    errors.push({ field: 'name', message: 'Name too long (max 100 characters)' })
  }

  if (!fields.email) {
    errors.push({ field: 'email', message: 'Email is required' })
  } else if (!EMAIL_REGEX.test(fields.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' })
  }

  if (fields.phone && !PHONE_REGEX.test(fields.phone)) {
    errors.push({ field: 'phone', message: 'Invalid phone number format' })
  }

  if (!fields.message || fields.message.trim().length < 10) {
    errors.push({ field: 'message', message: 'Message is required (min 10 characters)' })
  } else if (fields.message.length > 5000) {
    errors.push({ field: 'message', message: 'Message too long (max 5000 characters)' })
  }

  if (fields.website && !URL_REGEX.test(fields.website)) {
    errors.push({ field: 'website', message: 'Invalid website URL' })
  }

  return { valid: errors.length === 0, errors }
}

function checkSpam(fields: FormFields): { isSpam: boolean; reasons: string[] } {
  const reasons: string[] = []
  const combined = `${fields.name || ''} ${fields.subject || ''} ${fields.message || ''}`

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push(`Matched spam pattern: ${pattern.source.slice(0, 30)}`)
    }
  }

  // Check for excessive URLs in message
  const urlCount = (fields.message || '').match(/https?:\/\//g)?.length || 0
  if (urlCount > 3) reasons.push(`Too many URLs in message (${urlCount})`)

  // Check for ALL CAPS
  const words = (fields.message || '').split(/\s+/)
  const capsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase())
  if (capsWords.length > words.length * 0.5 && words.length > 5) {
    reasons.push('Excessive capitalization')
  }

  return { isSpam: reasons.length > 0, reasons }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'contact-form',
  pricing: {
    defaultCostCents: 1,
    methods: {
      validate_form: { costCents: 1, displayName: 'Validate Form' },
      format_message: { costCents: 1, displayName: 'Format Message' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const validateForm = sg.wrap(async (args: FormInput) => {
  if (!args.fields || typeof args.fields !== 'object') throw new Error('fields object is required')

  const validation = validateFields(args.fields)
  const spam = checkSpam(args.fields)

  return {
    valid: validation.valid && !spam.isSpam,
    errors: validation.errors,
    spam: spam,
    fieldCount: Object.keys(args.fields).filter((k) => args.fields[k as keyof FormFields]).length,
  }
}, { method: 'validate_form' })

const formatMessage = sg.wrap(async (args: FormInput) => {
  if (!args.fields || typeof args.fields !== 'object') throw new Error('fields object is required')
  const f = args.fields

  const lines = [
    `From: ${f.name || 'Unknown'}`,
    `Email: ${f.email || 'Not provided'}`,
    f.phone ? `Phone: ${f.phone}` : null,
    f.company ? `Company: ${f.company}` : null,
    f.website ? `Website: ${f.website}` : null,
    '',
    `Subject: ${f.subject || 'No Subject'}`,
    '',
    f.message || 'No message content',
    '',
    `---`,
    `Received: ${new Date().toISOString()}`,
  ].filter((line) => line !== null)

  const html = [
    '<div style="font-family: sans-serif; max-width: 600px;">',
    `<h2>${f.subject || 'Contact Form Submission'}</h2>`,
    '<table style="width: 100%; border-collapse: collapse;">',
    `<tr><td style="padding: 8px; font-weight: bold;">Name</td><td style="padding: 8px;">${f.name || '-'}</td></tr>`,
    `<tr><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;">${f.email || '-'}</td></tr>`,
    f.phone ? `<tr><td style="padding: 8px; font-weight: bold;">Phone</td><td style="padding: 8px;">${f.phone}</td></tr>` : '',
    f.company ? `<tr><td style="padding: 8px; font-weight: bold;">Company</td><td style="padding: 8px;">${f.company}</td></tr>` : '',
    '</table>',
    `<div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">${(f.message || '').replace(/\n/g, '<br>')}</div>`,
    '</div>',
  ].join('\n')

  return {
    plainText: lines.join('\n'),
    html,
    subject: `Contact: ${f.subject || 'New submission'} from ${f.name || 'Unknown'}`,
    replyTo: f.email || null,
  }
}, { method: 'format_message' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { validateForm, formatMessage }

console.log('settlegrid-contact-form MCP server ready')
console.log('Methods: validate_form, format_message')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
