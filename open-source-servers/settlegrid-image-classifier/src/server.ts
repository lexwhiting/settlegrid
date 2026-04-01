/**
 * settlegrid-image-classifier — Image Analysis MCP Server
 *
 * Analyze images via HTTP headers and magic bytes detection.
 * No external API key needed — uses HTTP HEAD requests and partial fetches.
 *
 * Methods:
 *   classify_url(url)         — Fetch image metadata and classify    (2¢)
 *   analyze_metadata(url)     — Extract HTTP-level metadata          (2¢)
 *   detect_format(url)        — Detect format from magic bytes       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClassifyUrlInput {
  url: string
}

interface AnalyzeMetadataInput {
  url: string
}

interface DetectFormatInput {
  url: string
}

interface ImageInfo {
  format: string
  mimeType: string | null
  size: number | null
  dimensions: { width: number; height: number } | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_AGENT = 'settlegrid-image-classifier/1.0 (contact@settlegrid.ai)'

const URL_REGEX = /^https?:\/\/.+/

const MIME_TO_FORMAT: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/avif': 'AVIF',
  'image/heif': 'HEIF',
  'image/heic': 'HEIC',
  'image/apng': 'APNG',
  'image/jxl': 'JPEG XL',
}

// Magic byte signatures for common image formats
const MAGIC_BYTES: Array<{ signature: number[]; offset: number; format: string; mime: string }> = [
  { signature: [0xFF, 0xD8, 0xFF], offset: 0, format: 'JPEG', mime: 'image/jpeg' },
  { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, format: 'PNG', mime: 'image/png' },
  { signature: [0x47, 0x49, 0x46, 0x38], offset: 0, format: 'GIF', mime: 'image/gif' },
  { signature: [0x52, 0x49, 0x46, 0x46], offset: 0, format: 'WebP (RIFF)', mime: 'image/webp' }, // RIFF header, need to check WEBP at offset 8
  { signature: [0x42, 0x4D], offset: 0, format: 'BMP', mime: 'image/bmp' },
  { signature: [0x49, 0x49, 0x2A, 0x00], offset: 0, format: 'TIFF (LE)', mime: 'image/tiff' },
  { signature: [0x4D, 0x4D, 0x00, 0x2A], offset: 0, format: 'TIFF (BE)', mime: 'image/tiff' },
  { signature: [0x00, 0x00, 0x01, 0x00], offset: 0, format: 'ICO', mime: 'image/x-icon' },
  { signature: [0x00, 0x00, 0x02, 0x00], offset: 0, format: 'CUR', mime: 'image/x-icon' },
]

function matchMagicBytes(bytes: Uint8Array): { format: string; mime: string } | null {
  for (const sig of MAGIC_BYTES) {
    if (bytes.length < sig.offset + sig.signature.length) continue
    let match = true
    for (let i = 0; i < sig.signature.length; i++) {
      if (bytes[sig.offset + i] !== sig.signature[i]) {
        match = false
        break
      }
    }
    if (match) {
      // Special case: verify RIFF is actually WebP
      if (sig.format === 'WebP (RIFF)') {
        if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
          return { format: 'WebP', mime: 'image/webp' }
        }
        return { format: 'RIFF (not WebP)', mime: 'application/octet-stream' }
      }
      return { format: sig.format, mime: sig.mime }
    }
  }

  // Check for AVIF (ftyp box)
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (brand === 'avif' || brand === 'avis') return { format: 'AVIF', mime: 'image/avif' }
    if (brand === 'heic' || brand === 'heix') return { format: 'HEIC', mime: 'image/heic' }
    if (brand === 'heif' || brand === 'mif1') return { format: 'HEIF', mime: 'image/heif' }
  }

  // Check for SVG (text-based)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 256))
  if (/<svg\b/i.test(text) || /xmlns.*svg/i.test(text)) {
    return { format: 'SVG', mime: 'image/svg+xml' }
  }

  return null
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG IHDR chunk starts at byte 16, width at 16-19, height at 20-23
  if (bytes.length < 24) return null
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
  if (width > 0 && width < 100_000 && height > 0 && height < 100_000) {
    return { width, height }
  }
  return null
}

function parseGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // GIF dimensions at bytes 6-7 (width LE) and 8-9 (height LE)
  if (bytes.length < 10) return null
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49) return null
  const width = bytes[6] | (bytes[7] << 8)
  const height = bytes[8] | (bytes[9] << 8)
  if (width > 0 && height > 0) return { width, height }
  return null
}

function parseBmpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // BMP dimensions at bytes 18-21 (width LE) and 22-25 (height LE)
  if (bytes.length < 26) return null
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4D) return null
  const width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24)
  const height = Math.abs(bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24))
  if (width > 0 && height > 0) return { width, height }
  return null
}

function extractDimensions(bytes: Uint8Array, format: string): { width: number; height: number } | null {
  if (format === 'PNG') return parsePngDimensions(bytes)
  if (format === 'GIF') return parseGifDimensions(bytes)
  if (format === 'BMP') return parseBmpDimensions(bytes)
  return null
}

async function headRequest(url: string): Promise<{ headers: Record<string, string>; status: number; redirected: boolean; finalUrl: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => { headers[key] = value })
    return { headers, status: res.status, redirected: res.redirected, finalUrl: res.url }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchPartial(url: string, bytes: number = 64): Promise<Uint8Array> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Range: `bytes=0-${bytes - 1}`,
      },
      signal: controller.signal,
    })
    const buffer = await res.arrayBuffer()
    return new Uint8Array(buffer.slice(0, bytes))
  } finally {
    clearTimeout(timer)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'image-classifier',
  pricing: {
    defaultCostCents: 2,
    methods: {
      classify_url: { costCents: 2, displayName: 'Image Classification' },
      analyze_metadata: { costCents: 2, displayName: 'Metadata Analysis' },
      detect_format: { costCents: 2, displayName: 'Format Detection' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const classifyUrl = sg.wrap(async (args: ClassifyUrlInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (e.g. "https://example.com/photo.jpg")')
  }
  const url = args.url.trim()
  if (!URL_REGEX.test(url)) {
    throw new Error('url must start with http:// or https://')
  }

  const [headResult, bytesResult] = await Promise.allSettled([
    headRequest(url),
    fetchPartial(url, 64),
  ])

  const head = headResult.status === 'fulfilled' ? headResult.value : null
  const bytes = bytesResult.status === 'fulfilled' ? bytesResult.value : null

  if (!head && !bytes) {
    throw new Error('Unable to reach the image URL — check that the URL is accessible')
  }

  // Determine format from headers
  const contentType = head?.headers['content-type']?.split(';')[0]?.trim() ?? null
  const headerFormat = contentType ? MIME_TO_FORMAT[contentType] ?? null : null

  // Determine format from magic bytes
  const magicResult = bytes ? matchMagicBytes(bytes) : null

  // Determine size
  const contentLength = head?.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : null
  const size = contentLength && Number.isFinite(contentLength) ? contentLength : null

  // Determine dimensions from binary headers
  const dimensions = bytes && magicResult ? extractDimensions(bytes, magicResult.format) : null

  const format = magicResult?.format ?? headerFormat ?? 'unknown'
  const isImage = format !== 'unknown' || (contentType?.startsWith('image/') ?? false)

  // File extension from URL
  const urlPath = new URL(url).pathname
  const extension = urlPath.includes('.') ? urlPath.split('.').pop()?.toLowerCase() ?? null : null

  return {
    url,
    isImage,
    format,
    mimeType: magicResult?.mime ?? contentType,
    size: size ? { bytes: size, human: formatBytes(size) } : null,
    dimensions,
    extension,
    redirected: head?.redirected ?? false,
    finalUrl: head?.finalUrl ?? url,
  }
}, { method: 'classify_url' })

const analyzeMetadata = sg.wrap(async (args: AnalyzeMetadataInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (e.g. "https://example.com/photo.jpg")')
  }
  const url = args.url.trim()
  if (!URL_REGEX.test(url)) {
    throw new Error('url must start with http:// or https://')
  }

  const head = await headRequest(url)
  const contentType = head.headers['content-type']?.split(';')[0]?.trim() ?? null
  const contentLength = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : null
  const size = contentLength && Number.isFinite(contentLength) ? contentLength : null

  return {
    url,
    status: head.status,
    redirected: head.redirected,
    finalUrl: head.finalUrl,
    contentType,
    size: size ? { bytes: size, human: formatBytes(size) } : null,
    caching: {
      cacheControl: head.headers['cache-control'] ?? null,
      etag: head.headers['etag'] ?? null,
      lastModified: head.headers['last-modified'] ?? null,
      expires: head.headers['expires'] ?? null,
      age: head.headers['age'] ? parseInt(head.headers['age'], 10) : null,
    },
    cdn: {
      server: head.headers['server'] ?? null,
      via: head.headers['via'] ?? null,
      xCache: head.headers['x-cache'] ?? null,
      cfRay: head.headers['cf-ray'] ?? null,
      xAmzRequestId: head.headers['x-amz-request-id'] ?? null,
    },
    security: {
      accessControlAllowOrigin: head.headers['access-control-allow-origin'] ?? null,
      xContentTypeOptions: head.headers['x-content-type-options'] ?? null,
      contentSecurityPolicy: head.headers['content-security-policy'] ?? null,
    },
    acceptRanges: head.headers['accept-ranges'] ?? null,
    encoding: head.headers['content-encoding'] ?? null,
  }
}, { method: 'analyze_metadata' })

const detectFormat = sg.wrap(async (args: DetectFormatInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (e.g. "https://example.com/photo.jpg")')
  }
  const url = args.url.trim()
  if (!URL_REGEX.test(url)) {
    throw new Error('url must start with http:// or https://')
  }

  const bytes = await fetchPartial(url, 64)
  const magicResult = matchMagicBytes(bytes)

  // Also get the content-type header for comparison
  const head = await headRequest(url)
  const contentType = head.headers['content-type']?.split(';')[0]?.trim() ?? null
  const headerFormat = contentType ? MIME_TO_FORMAT[contentType] ?? null : null

  // URL extension
  const urlPath = new URL(url).pathname
  const extension = urlPath.includes('.') ? urlPath.split('.').pop()?.toLowerCase() ?? null : null

  const dimensions = bytes && magicResult ? extractDimensions(bytes, magicResult.format) : null

  const magicBytesHex = Array.from(bytes.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ')

  // Check for mismatches
  const formatFromMagic = magicResult?.format ?? null
  const hasMismatch = headerFormat !== null && formatFromMagic !== null && headerFormat !== formatFromMagic

  return {
    url,
    detection: {
      fromMagicBytes: formatFromMagic,
      fromContentType: headerFormat,
      fromExtension: extension?.toUpperCase() ?? null,
      confidence: formatFromMagic ? 'high' : (headerFormat ? 'medium' : 'low'),
    },
    resolvedFormat: formatFromMagic ?? headerFormat ?? extension?.toUpperCase() ?? 'unknown',
    resolvedMime: magicResult?.mime ?? contentType ?? 'application/octet-stream',
    dimensions,
    hasMismatch,
    mismatchWarning: hasMismatch
      ? `File header indicates ${formatFromMagic} but Content-Type says ${headerFormat} — the file may be mislabeled`
      : null,
    magicBytesHex,
  }
}, { method: 'detect_format' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { classifyUrl, analyzeMetadata, detectFormat }

console.log('settlegrid-image-classifier MCP server ready')
console.log('Methods: classify_url, analyze_metadata, detect_format')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
