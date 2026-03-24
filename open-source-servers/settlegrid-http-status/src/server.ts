/**
 * settlegrid-http-status — HTTP Status Codes MCP Server
 *
 * Provides HTTP status code reference with SettleGrid billing.
 * No API key needed — local data.
 *
 * Methods:
 *   get_status_info(code) — status code info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface StatusInput { code: number }

const CODES: Record<number, { name: string; desc: string; category: string }> = {
  100: { name: 'Continue', desc: 'Server received request headers, client should proceed.', category: 'Informational' },
  200: { name: 'OK', desc: 'Request succeeded.', category: 'Success' },
  201: { name: 'Created', desc: 'Request succeeded and a new resource was created.', category: 'Success' },
  204: { name: 'No Content', desc: 'Request succeeded with no response body.', category: 'Success' },
  301: { name: 'Moved Permanently', desc: 'Resource has been permanently moved.', category: 'Redirection' },
  302: { name: 'Found', desc: 'Resource temporarily at different URI.', category: 'Redirection' },
  304: { name: 'Not Modified', desc: 'Resource has not been modified since last request.', category: 'Redirection' },
  400: { name: 'Bad Request', desc: 'Server cannot process request due to client error.', category: 'Client Error' },
  401: { name: 'Unauthorized', desc: 'Authentication is required.', category: 'Client Error' },
  403: { name: 'Forbidden', desc: 'Server refuses to authorize the request.', category: 'Client Error' },
  404: { name: 'Not Found', desc: 'Requested resource could not be found.', category: 'Client Error' },
  405: { name: 'Method Not Allowed', desc: 'HTTP method not allowed for this resource.', category: 'Client Error' },
  408: { name: 'Request Timeout', desc: 'Server timed out waiting for the request.', category: 'Client Error' },
  409: { name: 'Conflict', desc: 'Request conflicts with current state of the resource.', category: 'Client Error' },
  422: { name: 'Unprocessable Entity', desc: 'Request was well-formed but could not be followed.', category: 'Client Error' },
  429: { name: 'Too Many Requests', desc: 'User has sent too many requests.', category: 'Client Error' },
  500: { name: 'Internal Server Error', desc: 'Server encountered an unexpected condition.', category: 'Server Error' },
  502: { name: 'Bad Gateway', desc: 'Server received an invalid response from upstream.', category: 'Server Error' },
  503: { name: 'Service Unavailable', desc: 'Server is temporarily unable to handle the request.', category: 'Server Error' },
  504: { name: 'Gateway Timeout', desc: 'Server did not receive a timely response from upstream.', category: 'Server Error' },
}

const sg = settlegrid.init({
  toolSlug: 'http-status',
  pricing: { defaultCostCents: 1, methods: { get_status_info: { costCents: 1, displayName: 'Status Info' } } },
})

const getStatusInfo = sg.wrap(async (args: StatusInput) => {
  if (!args.code || args.code < 100 || args.code > 599) throw new Error('Valid HTTP status code (100-599) required')
  const info = CODES[args.code]
  if (info) return { code: args.code, ...info }
  const cat = args.code < 200 ? 'Informational' : args.code < 300 ? 'Success' : args.code < 400 ? 'Redirection' : args.code < 500 ? 'Client Error' : 'Server Error'
  return { code: args.code, name: 'Unknown', desc: 'Non-standard status code.', category: cat }
}, { method: 'get_status_info' })

export { getStatusInfo }

console.log('settlegrid-http-status MCP server ready')
console.log('Methods: get_status_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
