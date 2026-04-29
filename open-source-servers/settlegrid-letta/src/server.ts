/**
 * settlegrid-letta — Letta AI Agent Management MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.letta.com'

interface ListAgentsInput { limit?: number }
interface CreateAgentInput { name: string; model?: string; system?: string }
interface GetAgentInput { agent_id: string }
interface UpdateAgentInput { agent_id: string; name?: string; system?: string }
interface DeleteAgentInput { agent_id: string }
interface SendMessageInput { agent_id: string; message: string; role?: string }
interface GetMessagesInput { agent_id: string; limit?: number }

function getApiKey(): string {
  const k = process.env.LETTA_API_KEY
  if (!k) throw new Error('LETTA_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-letta/1.0',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Letta API ${res.status}: ${errText}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

const sg = settlegrid.init({
  toolSlug: 'letta',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_agents:   { costCents: 1, displayName: 'List Agents' },
      create_agent:  { costCents: 5, displayName: 'Create Agent' },
      get_agent:     { costCents: 1, displayName: 'Get Agent' },
      update_agent:  { costCents: 3, displayName: 'Update Agent' },
      delete_agent:  { costCents: 2, displayName: 'Delete Agent' },
      send_message:  { costCents: 5, displayName: 'Send Message' },
      get_messages:  { costCents: 1, displayName: 'Get Messages' },
    },
  },
})

const listAgents = sg.wrap(async (args: ListAgentsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/v1/agents?limit=${limit}`)
}, { method: 'list_agents' })

const createAgent = sg.wrap(async (args: CreateAgentInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const body: Record<string, unknown> = { name }
  if (args.model) body.model = args.model.trim()
  if (args.system) body.system = args.system.trim()
  return apiFetch('/v1/agents', { method: 'POST', body })
}, { method: 'create_agent' })

const getAgent = sg.wrap(async (args: GetAgentInput) => {
  const id = args.agent_id?.trim()
  if (!id) throw new Error('agent_id is required')
  return apiFetch(`/v1/agents/${encodeURIComponent(id)}`)
}, { method: 'get_agent' })

const updateAgent = sg.wrap(async (args: UpdateAgentInput) => {
  const id = args.agent_id?.trim()
  if (!id) throw new Error('agent_id is required')
  const body: Record<string, unknown> = {}
  if (args.name) body.name = args.name.trim()
  if (args.system) body.system = args.system.trim()
  return apiFetch(`/v1/agents/${encodeURIComponent(id)}`, { method: 'PUT', body })
}, { method: 'update_agent' })

const deleteAgent = sg.wrap(async (args: DeleteAgentInput) => {
  const id = args.agent_id?.trim()
  if (!id) throw new Error('agent_id is required')
  return apiFetch(`/v1/agents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'delete_agent' })

const sendMessage = sg.wrap(async (args: SendMessageInput) => {
  const id = args.agent_id?.trim()
  if (!id) throw new Error('agent_id is required')
  const message = args.message?.trim()
  if (!message) throw new Error('message is required')
  const role = args.role?.trim() || 'user'
  const body = {
    messages: [
      { role, content: message },
    ],
  }
  return apiFetch(`/v1/agents/${encodeURIComponent(id)}/messages`, { method: 'POST', body })
}, { method: 'send_message' })

const getMessages = sg.wrap(async (args: GetMessagesInput) => {
  const id = args.agent_id?.trim()
  if (!id) throw new Error('agent_id is required')
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/v1/agents/${encodeURIComponent(id)}/messages?limit=${limit}`)
}, { method: 'get_messages' })

export { listAgents, createAgent, getAgent, updateAgent, deleteAgent, sendMessage, getMessages }
console.log('settlegrid-letta MCP server ready')
console.log('Methods: list_agents, create_agent, get_agent, update_agent, delete_agent, send_message, get_messages')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')