/**
 * settlegrid-arize-ax — Arize AX MCP Server
 * Manages spaces, models, and monitors in the Arize AX observability platform.
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.arize.com'

interface GetSpaceInput { space_id: string }
interface ListModelsInput { space_id: string }
interface GetModelInput { space_id: string; model_id: string }
interface DeleteModelInput { space_id: string; model_id: string }
interface ListMonitorsInput { space_id: string }
interface GetMonitorInput { space_id: string; monitor_id: string }
interface DeleteMonitorInput { space_id: string; monitor_id: string }

function getApiKey(): string {
  const k = process.env.ARIZE_API_KEY
  if (!k) throw new Error('ARIZE_API_KEY environment variable is required')
  return k
}

async function arizeRequest(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const apiKey = getApiKey()
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-arize-ax/1.0',
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Arize AX API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  if (res.status === 204) return { success: true }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'arize-ax',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_spaces:    { costCents: 1, displayName: 'List Spaces' },
      get_space:      { costCents: 1, displayName: 'Get Space' },
      list_models:    { costCents: 1, displayName: 'List Models' },
      get_model:      { costCents: 1, displayName: 'Get Model' },
      delete_model:   { costCents: 3, displayName: 'Delete Model' },
      list_monitors:  { costCents: 1, displayName: 'List Monitors' },
      get_monitor:    { costCents: 1, displayName: 'Get Monitor' },
      delete_monitor: { costCents: 3, displayName: 'Delete Monitor' },
    },
  },
})

const listSpaces = sg.wrap(async () => {
  return arizeRequest('/v1/spaces')
}, { method: 'list_spaces' })

const getSpace = sg.wrap(async (args: GetSpaceInput) => {
  const spaceId = args.space_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}`)
}, { method: 'get_space' })

const listModels = sg.wrap(async (args: ListModelsInput) => {
  const spaceId = args.space_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/models`)
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const spaceId = args.space_id?.trim()
  const modelId = args.model_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  if (!modelId) throw new Error('model_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/models/${encodeURIComponent(modelId)}`)
}, { method: 'get_model' })

const deleteModel = sg.wrap(async (args: DeleteModelInput) => {
  const spaceId = args.space_id?.trim()
  const modelId = args.model_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  if (!modelId) throw new Error('model_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/models/${encodeURIComponent(modelId)}`, 'DELETE')
}, { method: 'delete_model' })

const listMonitors = sg.wrap(async (args: ListMonitorsInput) => {
  const spaceId = args.space_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/monitors`)
}, { method: 'list_monitors' })

const getMonitor = sg.wrap(async (args: GetMonitorInput) => {
  const spaceId = args.space_id?.trim()
  const monitorId = args.monitor_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  if (!monitorId) throw new Error('monitor_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/monitors/${encodeURIComponent(monitorId)}`)
}, { method: 'get_monitor' })

const deleteMonitor = sg.wrap(async (args: DeleteMonitorInput) => {
  const spaceId = args.space_id?.trim()
  const monitorId = args.monitor_id?.trim()
  if (!spaceId) throw new Error('space_id is required')
  if (!monitorId) throw new Error('monitor_id is required')
  return arizeRequest(`/v1/spaces/${encodeURIComponent(spaceId)}/monitors/${encodeURIComponent(monitorId)}`, 'DELETE')
}, { method: 'delete_monitor' })

export { listSpaces, getSpace, listModels, getModel, deleteModel, listMonitors, getMonitor, deleteMonitor }
console.log('settlegrid-arize-ax MCP server ready')
console.log('Methods: list_spaces, get_space, list_models, get_model, delete_model, list_monitors, get_monitor, delete_monitor')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')