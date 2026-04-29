/**
 * settlegrid-qr-decode — QR Code Data Analyzer MCP Server
 *
 * QR Code Data Analyzer tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface AnalyzeInput { data: string }
interface GenerateUrlInput { content: string; size?: number }

const sg = settlegrid.init({ toolSlug: 'qr-decode', pricing: { defaultCostCents: 1, methods: {
  analyze_data: { costCents: 1, displayName: 'Analyze QR Data' },
  generate_url: { costCents: 1, displayName: 'Generate QR URL' },
  detect_type: { costCents: 1, displayName: 'Detect Data Type' },
}}})

function detectDataType(data: string): { type: string; parsed: Record<string, unknown> } {
  if (data.startsWith('http://') || data.startsWith('https://')) return { type: 'URL', parsed: { url: data, protocol: data.split('://')[0] } }
  if (data.startsWith('WIFI:')) { const parts: Record<string, string> = {}; data.replace(/WIFI:/, '').split(';').forEach(p => { const [k, v] = p.split(':'); if (k && v) parts[k] = v }); return { type: 'WiFi', parsed: parts } }
  if (data.startsWith('mailto:')) return { type: 'Email', parsed: { email: data.replace('mailto:', '') } }
  if (data.startsWith('tel:')) return { type: 'Phone', parsed: { number: data.replace('tel:', '') } }
  if (data.startsWith('BEGIN:VCARD')) return { type: 'vCard', parsed: { format: 'vCard contact' } }
  if (data.startsWith('BEGIN:VEVENT')) return { type: 'Calendar Event', parsed: { format: 'iCalendar event' } }
  if (/^\d{8,14}$/.test(data)) return { type: 'Barcode/EAN', parsed: { digits: data.length } }
  return { type: 'Text', parsed: { length: data.length } }
}

const analyzeData = sg.wrap(async (args: AnalyzeInput) => {
  if (!args.data) throw new Error('data (QR content string) required')
  const detection = detectDataType(args.data)
  return { data: args.data, ...detection, char_count: args.data.length, encoding: /[^\x00-\x7F]/.test(args.data) ? 'UTF-8' : 'ASCII' }
}, { method: 'analyze_data' })

const generateUrl = sg.wrap(async (args: GenerateUrlInput) => {
  if (!args.content) throw new Error('content required')
  const size = Math.min(Math.max(args.size ?? 200, 100), 1000)
  const encoded = encodeURIComponent(args.content)
  return { content: args.content, qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`, size: `${size}x${size}`, api: 'goqr.me (free)' }
}, { method: 'generate_url' })

const detectType = sg.wrap(async (args: { data: string }) => {
  if (!args.data) throw new Error('data required')
  return detectDataType(args.data)
}, { method: 'detect_type' })

export { analyzeData, generateUrl, detectType }
console.log('settlegrid-qr-decode MCP server ready | Powered by SettleGrid')
