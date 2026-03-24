/**
 * settlegrid-json-validator — JSON Validator MCP Server
 *
 * Validates and formats JSON locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   validate_json(json) — validate and format (1¢)
 *   minify_json(json) — minify JSON (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface JsonInput { json: string }

const sg = settlegrid.init({
  toolSlug: 'json-validator',
  pricing: { defaultCostCents: 1, methods: { validate_json: { costCents: 1, displayName: 'Validate JSON' }, minify_json: { costCents: 1, displayName: 'Minify JSON' } } },
})

const validateJson = sg.wrap(async (args: JsonInput) => {
  if (!args.json) throw new Error('json is required')
  try {
    const parsed = JSON.parse(args.json)
    const formatted = JSON.stringify(parsed, null, 2)
    const type = Array.isArray(parsed) ? 'array' : typeof parsed
    const keys = type === 'object' ? Object.keys(parsed) : undefined
    return { valid: true, type, key_count: keys?.length, formatted, original_length: args.json.length, formatted_length: formatted.length }
  } catch (e: any) {
    return { valid: false, error: e.message, position: e.message.match(/position (\d+)/)?.[1] }
  }
}, { method: 'validate_json' })

const minifyJson = sg.wrap(async (args: JsonInput) => {
  if (!args.json) throw new Error('json is required')
  try {
    const parsed = JSON.parse(args.json)
    const minified = JSON.stringify(parsed)
    return { valid: true, minified, original_length: args.json.length, minified_length: minified.length, savings_pct: Math.round((1 - minified.length / args.json.length) * 100) }
  } catch (e: any) {
    throw new Error(`Invalid JSON: ${e.message}`)
  }
}, { method: 'minify_json' })

export { validateJson, minifyJson }

console.log('settlegrid-json-validator MCP server ready')
console.log('Methods: validate_json, minify_json')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
