/**
 * settlegrid-llamaparse — LlamaParse Document Parsing MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.cloud.llamaindex.ai'

function getApiKey(): string {
  const k = process.env.LLAMA_CLOUD_API_KEY
  if (!k) throw new Error('LLAMA_CLOUD_API_KEY environment variable is required')
  return k
}

interface UploadFileInput {
  file_content: string
  file_name: string
  content_type?: string
}

interface JobIdInput {
  job_id: string
}

interface PageImageInput {
  job_id: string
  page: number
}

const sg = settlegrid.init({
  toolSlug: 'llamaparse',
  pricing: {
    defaultCostCents: 2,
    methods: {
      upload_file_for_parsing: { costCents: 5, displayName: 'Upload File for Parsing' },
      get_job_status: { costCents: 1, displayName: 'Get Job Status' },
      get_result_markdown: { costCents: 2, displayName: 'Get Result Markdown' },
      get_result_text: { costCents: 2, displayName: 'Get Result Text' },
      get_result_json: { costCents: 2, displayName: 'Get Result JSON' },
      get_page_image: { costCents: 2, displayName: 'Get Page Image' },
      delete_job: { costCents: 1, displayName: 'Delete Job' },
    },
  },
})

const uploadFileForParsing = sg.wrap(async (args: UploadFileInput) => {
  const apiKey = getApiKey()
  const fileName = args.file_name?.trim()
  if (!fileName) throw new Error('file_name is required')
  const fileContent = args.file_content?.trim()
  if (!fileContent) throw new Error('file_content is required')
  const mimeType = args.content_type?.trim() || 'application/pdf'

  // Decode base64 to binary
  const binaryStr = atob(fileContent)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })

  const formData = new FormData()
  formData.append('file', blob, fileName)

  const res = await fetch(`${BASE}/api/parsing/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
    },
    body: formData,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse upload failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'upload_file_for_parsing' })

const getJobStatus = sg.wrap(async (args: JobIdInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse get job status failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_job_status' })

const getResultMarkdown = sg.wrap(async (args: JobIdInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}/result/raw/markdown`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse get markdown result failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_result_markdown' })

const getResultText = sg.wrap(async (args: JobIdInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}/result/raw/text`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse get text result failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_result_text' })

const getResultJson = sg.wrap(async (args: JobIdInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}/result/raw/json`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse get JSON result failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_result_json' })

const getPageImage = sg.wrap(async (args: PageImageInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')
  const page = Math.max(0, Math.floor(args.page ?? 0))

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}/result/page/${page}/png`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse get page image failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { job_id: jobId, page, content_type: 'image/png', data_base64: base64 }
}, { method: 'get_page_image' })

const deleteJob = sg.wrap(async (args: JobIdInput) => {
  const apiKey = getApiKey()
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')

  const res = await fetch(`${BASE}/api/parsing/job/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-llamaparse/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LlamaParse delete job failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { success: true, job_id: jobId } }
}, { method: 'delete_job' })

export { uploadFileForParsing, getJobStatus, getResultMarkdown, getResultText, getResultJson, getPageImage, deleteJob }
console.log('settlegrid-llamaparse MCP server ready')
console.log('Methods: upload_file_for_parsing, get_job_status, get_result_markdown, get_result_text, get_result_json, get_page_image, delete_job')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')