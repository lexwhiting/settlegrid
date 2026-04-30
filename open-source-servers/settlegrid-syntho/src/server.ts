/**
 * settlegrid-syntho — Syntho REST API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.syntho.ai'

interface GetOrganizationInput {}
interface ListUsersInput {}
interface CreateUserInput {
  username: string
  email: string
  password: string
  role?: string
}
interface GetUserInput {
  id: string
}
interface UpdateUserInput {
  id: string
  username?: string
  email?: string
  role?: string
}
interface DeleteUserInput {
  id: string
}

function getApiKey(): string {
  const k = process.env.SYNTHO_API_KEY
  if (!k) throw new Error('SYNTHO_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const token = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-syntho/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Syntho API ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return { success: true }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'syntho',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_organization: { costCents: 1, displayName: 'Get Organization' },
      list_users: { costCents: 1, displayName: 'List Users' },
      create_user: { costCents: 3, displayName: 'Create User' },
      get_user: { costCents: 1, displayName: 'Get User' },
      update_user: { costCents: 2, displayName: 'Update User' },
      delete_user: { costCents: 3, displayName: 'Delete User' },
    },
  },
})

const getOrganization = sg.wrap(async (_args: GetOrganizationInput) => {
  return apiFetch('/api/organization/')
}, { method: 'get_organization' })

const listUsers = sg.wrap(async (_args: ListUsersInput) => {
  return apiFetch('/api/organization/users/')
}, { method: 'list_users' })

const createUser = sg.wrap(async (args: CreateUserInput) => {
  const username = args.username?.trim()
  if (!username) throw new Error('username is required')
  const email = args.email?.trim()
  if (!email) throw new Error('email is required')
  const password = args.password
  if (!password) throw new Error('password is required')
  const body: Record<string, string> = { username, email, password }
  if (args.role) body.role = args.role.trim()
  return apiFetch('/api/organization/users/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_user' })

const getUser = sg.wrap(async (args: GetUserInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return apiFetch(`/api/organization/users/${encodeURIComponent(id)}/`)
}, { method: 'get_user' })

const updateUser = sg.wrap(async (args: UpdateUserInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  const body: Record<string, string> = {}
  if (args.username) body.username = args.username.trim()
  if (args.email) body.email = args.email.trim()
  if (args.role) body.role = args.role.trim()
  if (Object.keys(body).length === 0) throw new Error('At least one field to update is required (username, email, or role)')
  return apiFetch(`/api/organization/users/${encodeURIComponent(id)}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}, { method: 'update_user' })

const deleteUser = sg.wrap(async (args: DeleteUserInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return apiFetch(`/api/organization/users/${encodeURIComponent(id)}/`, {
    method: 'DELETE',
  })
}, { method: 'delete_user' })

export { getOrganization, listUsers, createUser, getUser, updateUser, deleteUser }
console.log('settlegrid-syntho MCP server ready')
console.log('Methods: get_organization, list_users, create_user, get_user, update_user, delete_user')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')