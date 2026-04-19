/**
 * settlegrid-weaviate — Weaviate User & Role Management MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface GetUserInput { userId: string }
interface CreateUserInput { userId: string }
interface GetUserRolesInput { userId: string; userType?: string }
interface GetRoleInput { roleName: string }
interface GetRoleUsersInput { roleName: string }
interface RotateUserKeyInput { userId: string }

function getApiKey(): string {
  const k = process.env.WEAVIATE_API_KEY
  if (!k) throw new Error('WEAVIATE_API_KEY environment variable is required')
  return k
}

function getBaseUrl(): string {
  const b = process.env.WEAVIATE_BASE_URL
  if (!b) throw new Error('WEAVIATE_BASE_URL environment variable is required (e.g. https://your-instance.weaviate.network/v1)')
  return b.replace(/\/$/, '')
}

async function weaviateFetch(
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<unknown> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': 'settlegrid-weaviate/1.0',
    'Accept': 'application/json',
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weaviate API ${res.status} ${res.statusText}: ${text.slice(0, 300)}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return res.json()
  }
  return { status: res.status, body: await res.text() }
}

const sg = settlegrid.init({
  toolSlug: 'weaviate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_own_info: { costCents: 1, displayName: 'Get Own Info' },
      get_user: { costCents: 1, displayName: 'Get User' },
      create_user: { costCents: 3, displayName: 'Create User' },
      get_user_roles: { costCents: 1, displayName: 'Get User Roles' },
      list_roles: { costCents: 1, displayName: 'List Roles' },
      get_role: { costCents: 1, displayName: 'Get Role' },
      get_role_users: { costCents: 1, displayName: 'Get Role Users' },
      rotate_user_key: { costCents: 5, displayName: 'Rotate User Key' },
    },
  },
})

const getOwnInfo = sg.wrap(async () => {
  return weaviateFetch('/users/own-info')
}, { method: 'get_own_info' })

const getUser = sg.wrap(async (args: GetUserInput) => {
  const userId = args.userId?.trim()
  if (!userId) throw new Error('userId is required')
  return weaviateFetch(`/users/${encodeURIComponent(userId)}`)
}, { method: 'get_user' })

const createUser = sg.wrap(async (args: CreateUserInput) => {
  const userId = args.userId?.trim()
  if (!userId) throw new Error('userId is required')
  return weaviateFetch(`/users/${encodeURIComponent(userId)}`, 'POST')
}, { method: 'create_user' })

const getUserRoles = sg.wrap(async (args: GetUserRolesInput) => {
  const userId = args.userId?.trim()
  if (!userId) throw new Error('userId is required')
  let path = `/users/${encodeURIComponent(userId)}/roles`
  if (args.userType) {
    const allowed = ['db', 'oidc']
    const userType = args.userType.trim()
    if (!allowed.includes(userType)) throw new Error(`userType must be one of: ${allowed.join(', ')}`)
    path += `?userType=${encodeURIComponent(userType)}`
  }
  return weaviateFetch(path)
}, { method: 'get_user_roles' })

const listRoles = sg.wrap(async () => {
  return weaviateFetch('/authz/roles')
}, { method: 'list_roles' })

const getRole = sg.wrap(async (args: GetRoleInput) => {
  const roleName = args.roleName?.trim()
  if (!roleName) throw new Error('roleName is required')
  return weaviateFetch(`/authz/roles/${encodeURIComponent(roleName)}`)
}, { method: 'get_role' })

const getRoleUsers = sg.wrap(async (args: GetRoleUsersInput) => {
  const roleName = args.roleName?.trim()
  if (!roleName) throw new Error('roleName is required')
  return weaviateFetch(`/authz/roles/${encodeURIComponent(roleName)}/users`)
}, { method: 'get_role_users' })

const rotateUserKey = sg.wrap(async (args: RotateUserKeyInput) => {
  const userId = args.userId?.trim()
  if (!userId) throw new Error('userId is required')
  return weaviateFetch(`/users/${encodeURIComponent(userId)}/rotate-key`, 'POST')
}, { method: 'rotate_user_key' })

export {
  getOwnInfo,
  getUser,
  createUser,
  getUserRoles,
  listRoles,
  getRole,
  getRoleUsers,
  rotateUserKey,
}

console.log('settlegrid-weaviate MCP server ready')
console.log('Methods: get_own_info, get_user, create_user, get_user_roles, list_roles, get_role, get_role_users, rotate_user_key')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')