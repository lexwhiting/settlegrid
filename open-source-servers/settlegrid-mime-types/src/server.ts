/**
 * settlegrid-mime-types — MIME Type Lookup MCP Server
 *
 * Look up MIME types by extension and vice versa. All local computation.
 *
 * Methods:
 *   lookup_mime(extension) — Get MIME type for file extension (free)
 *   lookup_extension(mimeType) — Get extension for MIME type (free)
 *   get_mime_info(mimeType) — Detailed MIME type info (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ExtInput { extension: string }
interface MimeInput { mimeType: string }

const MIME_DB: Record<string, { mime: string; compressible: boolean; category: string }> = {
  html: { mime: 'text/html', compressible: true, category: 'Document' },
  htm: { mime: 'text/html', compressible: true, category: 'Document' },
  css: { mime: 'text/css', compressible: true, category: 'Stylesheet' },
  js: { mime: 'application/javascript', compressible: true, category: 'Script' },
  mjs: { mime: 'application/javascript', compressible: true, category: 'Script' },
  json: { mime: 'application/json', compressible: true, category: 'Data' },
  xml: { mime: 'application/xml', compressible: true, category: 'Data' },
  csv: { mime: 'text/csv', compressible: true, category: 'Data' },
  txt: { mime: 'text/plain', compressible: true, category: 'Text' },
  md: { mime: 'text/markdown', compressible: true, category: 'Document' },
  pdf: { mime: 'application/pdf', compressible: false, category: 'Document' },
  doc: { mime: 'application/msword', compressible: false, category: 'Document' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compressible: false, category: 'Document' },
  xls: { mime: 'application/vnd.ms-excel', compressible: false, category: 'Spreadsheet' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compressible: false, category: 'Spreadsheet' },
  ppt: { mime: 'application/vnd.ms-powerpoint', compressible: false, category: 'Presentation' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compressible: false, category: 'Presentation' },
  png: { mime: 'image/png', compressible: false, category: 'Image' },
  jpg: { mime: 'image/jpeg', compressible: false, category: 'Image' },
  jpeg: { mime: 'image/jpeg', compressible: false, category: 'Image' },
  gif: { mime: 'image/gif', compressible: false, category: 'Image' },
  svg: { mime: 'image/svg+xml', compressible: true, category: 'Image' },
  webp: { mime: 'image/webp', compressible: false, category: 'Image' },
  avif: { mime: 'image/avif', compressible: false, category: 'Image' },
  ico: { mime: 'image/x-icon', compressible: false, category: 'Image' },
  bmp: { mime: 'image/bmp', compressible: false, category: 'Image' },
  tiff: { mime: 'image/tiff', compressible: false, category: 'Image' },
  mp3: { mime: 'audio/mpeg', compressible: false, category: 'Audio' },
  wav: { mime: 'audio/wav', compressible: false, category: 'Audio' },
  ogg: { mime: 'audio/ogg', compressible: false, category: 'Audio' },
  flac: { mime: 'audio/flac', compressible: false, category: 'Audio' },
  aac: { mime: 'audio/aac', compressible: false, category: 'Audio' },
  mp4: { mime: 'video/mp4', compressible: false, category: 'Video' },
  webm: { mime: 'video/webm', compressible: false, category: 'Video' },
  avi: { mime: 'video/x-msvideo', compressible: false, category: 'Video' },
  mov: { mime: 'video/quicktime', compressible: false, category: 'Video' },
  mkv: { mime: 'video/x-matroska', compressible: false, category: 'Video' },
  zip: { mime: 'application/zip', compressible: false, category: 'Archive' },
  gz: { mime: 'application/gzip', compressible: false, category: 'Archive' },
  tar: { mime: 'application/x-tar', compressible: false, category: 'Archive' },
  '7z': { mime: 'application/x-7z-compressed', compressible: false, category: 'Archive' },
  rar: { mime: 'application/x-rar-compressed', compressible: false, category: 'Archive' },
  woff: { mime: 'font/woff', compressible: false, category: 'Font' },
  woff2: { mime: 'font/woff2', compressible: false, category: 'Font' },
  ttf: { mime: 'font/ttf', compressible: false, category: 'Font' },
  otf: { mime: 'font/otf', compressible: false, category: 'Font' },
  eot: { mime: 'application/vnd.ms-fontobject', compressible: false, category: 'Font' },
  wasm: { mime: 'application/wasm', compressible: true, category: 'Binary' },
  yaml: { mime: 'text/yaml', compressible: true, category: 'Data' },
  yml: { mime: 'text/yaml', compressible: true, category: 'Data' },
  toml: { mime: 'application/toml', compressible: true, category: 'Data' },
  ts: { mime: 'video/mp2t', compressible: false, category: 'Video' },
  tsx: { mime: 'text/tsx', compressible: true, category: 'Script' },
  jsx: { mime: 'text/jsx', compressible: true, category: 'Script' },
}

const REVERSE_MAP: Record<string, string[]> = {}
for (const [ext, info] of Object.entries(MIME_DB)) {
  if (!REVERSE_MAP[info.mime]) REVERSE_MAP[info.mime] = []
  REVERSE_MAP[info.mime].push(ext)
}

const sg = settlegrid.init({
  toolSlug: 'mime-types',
  pricing: {
    defaultCostCents: 0,
    methods: {
      lookup_mime: { costCents: 0, displayName: 'Lookup MIME' },
      lookup_extension: { costCents: 0, displayName: 'Lookup Extension' },
      get_mime_info: { costCents: 0, displayName: 'MIME Info' },
    },
  },
})

const lookupMime = sg.wrap(async (args: ExtInput) => {
  const ext = args.extension?.replace(/^\./, '').toLowerCase().trim()
  if (!ext) throw new Error('extension required')
  const info = MIME_DB[ext]
  if (!info) return { extension: ext, mime: null, found: false }
  return { extension: ext, ...info, found: true }
}, { method: 'lookup_mime' })

const lookupExtension = sg.wrap(async (args: MimeInput) => {
  const mime = args.mimeType?.toLowerCase().trim()
  if (!mime) throw new Error('mimeType required')
  const exts = REVERSE_MAP[mime]
  if (!exts) return { mimeType: mime, extensions: [], found: false }
  return { mimeType: mime, extensions: exts, primary: exts[0], found: true }
}, { method: 'lookup_extension' })

const getMimeInfo = sg.wrap(async (args: MimeInput) => {
  const mime = args.mimeType?.toLowerCase().trim()
  if (!mime) throw new Error('mimeType required')
  const [type, subtype] = mime.split('/')
  const exts = REVERSE_MAP[mime] || []
  return { mimeType: mime, type, subtype, extensions: exts, binary: !type.startsWith('text'), compressible: exts.length > 0 ? MIME_DB[exts[0]]?.compressible ?? null : null }
}, { method: 'get_mime_info' })

export { lookupMime, lookupExtension, getMimeInfo }

console.log('settlegrid-mime-types MCP server ready')
console.log('Methods: lookup_mime, lookup_extension, get_mime_info')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
