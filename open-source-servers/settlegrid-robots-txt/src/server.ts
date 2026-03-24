/**
 * settlegrid-robots-txt — Robots.txt Parser MCP Server
 *
 * Methods:
 *   get_robots(domain)               (1¢)
 *   check_url(domain, path, agent)   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetRobotsInput { domain: string }
interface CheckUrlInput { domain: string; path: string; user_agent?: string }

interface RobotsRule { user_agent: string; allow: string[]; disallow: string[]; crawl_delay?: number; sitemaps: string[] }

function parseRobotsTxt(text: string): RobotsRule[] {
  const rules: RobotsRule[] = []
  let current: RobotsRule | null = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split(':')
    const value = rest.join(':').trim()
    const lk = key.toLowerCase().trim()
    if (lk === 'user-agent') {
      current = { user_agent: value, allow: [], disallow: [], sitemaps: [] }
      rules.push(current)
    } else if (current) {
      if (lk === 'allow') current.allow.push(value)
      else if (lk === 'disallow') current.disallow.push(value)
      else if (lk === 'crawl-delay') current.crawl_delay = parseInt(value)
      else if (lk === 'sitemap') current.sitemaps.push(value)
    }
  }
  return rules
}

const USER_AGENT = 'settlegrid-robots-txt/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'robots-txt',
  pricing: { defaultCostCents: 1, methods: {
    get_robots: { costCents: 1, displayName: 'Get and parse robots.txt' },
    check_url: { costCents: 1, displayName: 'Check if URL is crawlable' },
  }},
})

const getRobots = sg.wrap(async (args: GetRobotsInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = args.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const res = await fetch(`https://${domain}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return { domain, found: false, status: res.status }
  const text = await res.text()
  const rules = parseRobotsTxt(text)
  return { domain, found: true, rules, raw_length: text.length }
}, { method: 'get_robots' })

const checkUrl = sg.wrap(async (args: CheckUrlInput) => {
  if (!args.domain || !args.path) throw new Error('domain and path are required')
  const domain = args.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const agent = args.user_agent || '*'
  const res = await fetch(`https://${domain}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return { domain, path: args.path, allowed: true, reason: 'No robots.txt found' }
  const rules = parseRobotsTxt(await res.text())
  const matching = rules.filter(r => r.user_agent === agent || r.user_agent === '*')
  let allowed = true
  for (const rule of matching) {
    for (const d of rule.disallow) {
      if (args.path.startsWith(d) && d !== '') allowed = false
    }
    for (const a of rule.allow) {
      if (args.path.startsWith(a)) allowed = true
    }
  }
  return { domain, path: args.path, user_agent: agent, allowed }
}, { method: 'check_url' })

export { getRobots, checkUrl }

console.log('settlegrid-robots-txt MCP server ready')
console.log('Methods: get_robots, check_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
