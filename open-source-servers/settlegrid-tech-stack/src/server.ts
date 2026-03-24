/**
 * settlegrid-tech-stack — Website Tech Stack Detection MCP Server
 *
 * Detects technologies used by a website by analyzing HTTP headers.
 * No API key needed.
 *
 * Methods:
 *   detect_stack(url)                (2¢)
 *   get_headers(url)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DetectStackInput { url: string }

const USER_AGENT = 'settlegrid-tech-stack/1.0 (contact@settlegrid.ai)'

function detectFromHeaders(headers: Record<string, string>): string[] {
  const techs: string[] = []
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]))
  if (h['server']?.includes('nginx')) techs.push('Nginx')
  if (h['server']?.includes('apache')) techs.push('Apache')
  if (h['server']?.includes('cloudflare')) techs.push('Cloudflare')
  if (h['x-powered-by']?.includes('express')) techs.push('Express.js')
  if (h['x-powered-by']?.includes('php')) techs.push('PHP')
  if (h['x-powered-by']?.includes('next.js')) techs.push('Next.js')
  if (h['x-vercel-id']) techs.push('Vercel')
  if (h['x-amz-cf-id'] || h['x-amz-request-id']) techs.push('AWS')
  if (h['x-github-request-id']) techs.push('GitHub Pages')
  if (h['cf-ray']) techs.push('Cloudflare')
  if (h['x-shopify-stage']) techs.push('Shopify')
  if (h['x-wix-request-id']) techs.push('Wix')
  if (h['x-drupal-cache']) techs.push('Drupal')
  if (h['x-wordpress']) techs.push('WordPress')
  if (h['set-cookie']?.includes('wp_')) techs.push('WordPress')
  return [...new Set(techs)]
}

const sg = settlegrid.init({
  toolSlug: 'tech-stack',
  pricing: { defaultCostCents: 1, methods: {
    detect_stack: { costCents: 2, displayName: 'Detect website tech stack' },
    get_headers: { costCents: 1, displayName: 'Get HTTP headers' },
  }},
})

const detectStack = sg.wrap(async (args: DetectStackInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url
  if (!url.startsWith('http')) url = `https://${url}`
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  const headers: Record<string, string> = {}
  res.headers.forEach((v, k) => { headers[k] = v })
  const techs = detectFromHeaders(headers)
  return { url, status: res.status, technologies: techs, headers_analyzed: Object.keys(headers).length }
}, { method: 'detect_stack' })

const getHeaders = sg.wrap(async (args: DetectStackInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url
  if (!url.startsWith('http')) url = `https://${url}`
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  const headers: Record<string, string> = {}
  res.headers.forEach((v, k) => { headers[k] = v })
  return { url, status: res.status, headers }
}, { method: 'get_headers' })

export { detectStack, getHeaders }

console.log('settlegrid-tech-stack MCP server ready')
console.log('Methods: detect_stack, get_headers')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
