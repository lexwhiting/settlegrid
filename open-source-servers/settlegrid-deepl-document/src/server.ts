/**
 * settlegrid-deepl-document — DeepL Document Translation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.deepl.com'

interface UploadDocumentInput {
  file_url: string
  target_lang: string
  source_lang?: string
  filename?: string
  formality?: string
  glossary_id?: string
  output_format?: string
}

interface DocumentStatusInput {
  document_id: string
  document_key: string
}

interface DownloadDocumentInput {
  document_id: string
  document_key: string
}

function getApiKey(): string {
  const k = process.env.DEEPL_API_KEY
  if (!k) throw new Error('DEEPL_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'deepl-document',
  pricing: {
    defaultCostCents: 2,
    methods: {
      upload_document: { costCents: 5, displayName: 'Upload Document' },
      get_document_status: { costCents: 1, displayName: 'Get Document Status' },
      download_document: { costCents: 2, displayName: 'Download Document' },
    },
  },
})

const uploadDocument = sg.wrap(async (args: UploadDocumentInput) => {
  const apiKey = getApiKey()

  const fileUrl = args.file_url?.trim()
  if (!fileUrl) throw new Error('file_url is required')
  const targetLang = args.target_lang?.trim().toUpperCase()
  if (!targetLang) throw new Error('target_lang is required')

  // Fetch the remote file
  const fileRes = await fetch(fileUrl, {
    headers: { 'User-Agent': 'settlegrid-deepl-document/1.0' },
  })
  if (!fileRes.ok) throw new Error(`Failed to fetch file from URL: ${fileRes.status} ${fileRes.statusText}`)
  const fileBlob = await fileRes.blob()

  // Determine filename
  let filename = args.filename?.trim()
  if (!filename) {
    try {
      const urlPath = new URL(fileUrl).pathname
      filename = urlPath.substring(urlPath.lastIndexOf('/') + 1) || 'document'
    } catch {
      filename = 'document'
    }
  }

  const form = new FormData()
  form.append('file', fileBlob, filename)
  form.append('target_lang', targetLang)
  if (args.source_lang) form.append('source_lang', args.source_lang.trim().toUpperCase())
  if (args.formality) form.append('formality', args.formality.trim())
  if (args.glossary_id) form.append('glossary_id', args.glossary_id.trim())
  if (args.output_format) form.append('output_format', args.output_format.trim())

  const res = await fetch(`${BASE}/v2/document`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'User-Agent': 'settlegrid-deepl-document/1.0',
    },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`DeepL API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json() as { document_id: string; document_key: string }
  return {
    document_id: data.document_id,
    document_key: data.document_key,
    message: 'Document uploaded successfully. Use get_document_status to poll for completion, then download_document to retrieve the result.',
  }
}, { method: 'upload_document' })

const getDocumentStatus = sg.wrap(async (args: DocumentStatusInput) => {
  const apiKey = getApiKey()

  const documentId = args.document_id?.trim()
  if (!documentId) throw new Error('document_id is required')
  const documentKey = args.document_key?.trim()
  if (!documentKey) throw new Error('document_key is required')

  const res = await fetch(`${BASE}/v2/document/${encodeURIComponent(documentId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'User-Agent': 'settlegrid-deepl-document/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_key: documentKey }),
  } as RequestInit)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`DeepL API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json() as {
    document_id: string
    status: string
    seconds_remaining?: number
    billed_characters?: number
    error_message?: string
  }

  return {
    document_id: data.document_id,
    status: data.status,
    seconds_remaining: data.seconds_remaining,
    billed_characters: data.billed_characters,
    error_message: data.error_message,
    ready: data.status === 'done',
  }
}, { method: 'get_document_status' })

const downloadDocument = sg.wrap(async (args: DownloadDocumentInput) => {
  const apiKey = getApiKey()

  const documentId = args.document_id?.trim()
  if (!documentId) throw new Error('document_id is required')
  const documentKey = args.document_key?.trim()
  if (!documentKey) throw new Error('document_key is required')

  const res = await fetch(`${BASE}/v2/document/${encodeURIComponent(documentId)}/result`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'User-Agent': 'settlegrid-deepl-document/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_key: documentKey }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`DeepL API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const contentDisposition = res.headers.get('content-disposition') || ''
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return {
    content_type: contentType,
    content_disposition: contentDisposition,
    size_bytes: buffer.byteLength,
    data_base64: base64,
    message: 'Translated document returned as base64-encoded data.',
  }
}, { method: 'download_document' })

export { uploadDocument, getDocumentStatus, downloadDocument }
console.log('settlegrid-deepl-document MCP server ready')
console.log('Methods: upload_document, get_document_status, download_document')
console.log('Pricing: upload_document=5¢, get_document_status=1¢, download_document=2¢ | Powered by SettleGrid')