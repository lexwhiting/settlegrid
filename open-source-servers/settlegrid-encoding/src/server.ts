/**
 * settlegrid-encoding — Text Encoding Detection MCP Server
 *
 * Detect, encode, and convert text between formats. All local computation.
 *
 * Methods:
 *   encode_base64(text) — Encode text to base64 (free)
 *   decode_base64(encoded) — Decode base64 to text (free)
 *   encode_url(text) — URL-encode text (free)
 *   decode_url(encoded) — URL-decode text (free)
 *   encode_html(text) — HTML-encode text (free)
 *   decode_html(encoded) — HTML-decode text (free)
 *   encode_hex(text) — Text to hex string (free)
 *   detect_encoding(sample) — Detect encoding of byte sequence (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TextInput { text: string }
interface EncodedInput { encoded: string }
interface SampleInput { sample: string }

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
const HTML_REVERSE: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&copy;': '\u00a9', '&reg;': '\u00ae', '&trade;': '\u2122',
}

const sg = settlegrid.init({
  toolSlug: 'encoding',
  pricing: {
    defaultCostCents: 0,
    methods: {
      encode_base64: { costCents: 0, displayName: 'Encode Base64' },
      decode_base64: { costCents: 0, displayName: 'Decode Base64' },
      encode_url: { costCents: 0, displayName: 'URL Encode' },
      decode_url: { costCents: 0, displayName: 'URL Decode' },
      encode_html: { costCents: 0, displayName: 'HTML Encode' },
      decode_html: { costCents: 0, displayName: 'HTML Decode' },
      encode_hex: { costCents: 0, displayName: 'Hex Encode' },
      detect_encoding: { costCents: 0, displayName: 'Detect Encoding' },
    },
  },
})

const encodeBase64 = sg.wrap(async (args: TextInput) => {
  if (typeof args.text !== 'string') throw new Error('text required')
  const encoded = Buffer.from(args.text, 'utf-8').toString('base64')
  return { original: args.text, encoded, urlSafe: encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), bytes: Buffer.byteLength(args.text, 'utf-8') }
}, { method: 'encode_base64' })

const decodeBase64 = sg.wrap(async (args: EncodedInput) => {
  if (!args.encoded) throw new Error('encoded string required')
  const normalized = args.encoded.replace(/-/g, '+').replace(/_/g, '/')
  const decoded = Buffer.from(normalized, 'base64').toString('utf-8')
  return { encoded: args.encoded, decoded, bytes: Buffer.byteLength(decoded, 'utf-8') }
}, { method: 'decode_base64' })

const encodeUrl = sg.wrap(async (args: TextInput) => {
  if (typeof args.text !== 'string') throw new Error('text required')
  return { original: args.text, encoded: encodeURIComponent(args.text), encodedFull: encodeURI(args.text) }
}, { method: 'encode_url' })

const decodeUrl = sg.wrap(async (args: EncodedInput) => {
  if (!args.encoded) throw new Error('encoded string required')
  return { encoded: args.encoded, decoded: decodeURIComponent(args.encoded) }
}, { method: 'decode_url' })

const encodeHtml = sg.wrap(async (args: TextInput) => {
  if (typeof args.text !== 'string') throw new Error('text required')
  const encoded = args.text.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch)
  return { original: args.text, encoded }
}, { method: 'encode_html' })

const decodeHtml = sg.wrap(async (args: EncodedInput) => {
  if (!args.encoded) throw new Error('encoded string required')
  const decoded = args.encoded.replace(/&\w+;/g, (ent) => HTML_REVERSE[ent] || ent)
  return { encoded: args.encoded, decoded }
}, { method: 'decode_html' })

const encodeHex = sg.wrap(async (args: TextInput) => {
  if (typeof args.text !== 'string') throw new Error('text required')
  const hex = Buffer.from(args.text, 'utf-8').toString('hex')
  return { original: args.text, hex, bytes: hex.length / 2 }
}, { method: 'encode_hex' })

const detectEncoding = sg.wrap(async (args: SampleInput) => {
  const s = args.sample || ''
  const hasUtf8 = /[\u0080-\uffff]/.test(s)
  const hasBom = s.startsWith('\ufeff')
  const isAscii = /^[\x00-\x7f]*$/.test(s)
  return {
    likely: hasBom ? 'UTF-8 with BOM' : isAscii ? 'ASCII' : hasUtf8 ? 'UTF-8' : 'ASCII',
    isAscii, hasUnicode: hasUtf8, hasBom,
    byteLength: Buffer.byteLength(s, 'utf-8'), charLength: s.length,
  }
}, { method: 'detect_encoding' })

export { encodeBase64, decodeBase64, encodeUrl, decodeUrl, encodeHtml, decodeHtml, encodeHex, detectEncoding }

console.log('settlegrid-encoding MCP server ready')
console.log('Methods: encode_base64, decode_base64, encode_url, decode_url, encode_html, decode_html, encode_hex, detect_encoding')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
