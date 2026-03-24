/**
 * settlegrid-options-data — Options Chain Data MCP Server
 * Wraps CBOE delayed quotes with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OptionContract {
  option: string
  bid: number
  ask: number
  last_sale_price: number
  volume: number
  open_interest: number
  iv: number
  delta: number
  gamma: number
  theta: number
  type: 'call' | 'put'
  expiration: string
  strike: number
}

interface OptionQuote {
  symbol: string
  bid: number
  ask: number
  last: number
  volume: number
  open_interest: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://cdn.cboe.com/api/global/delayed_quotes/options'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CBOE API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'options-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getChain(symbol: string, expiration?: string): Promise<OptionContract[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_chain', async () => {
    const data = await fetchJSON<any>(`${API}/${encodeURIComponent(symbol.toUpperCase())}.json`)
    let options = data.data?.options || []
    if (expiration) {
      options = options.filter((o: any) => o.expiration_date === expiration)
    }
    return options.slice(0, 50).map((o: any) => ({
      option: o.option || '', bid: o.bid || 0, ask: o.ask || 0,
      last_sale_price: o.last_sale_price || 0, volume: o.volume || 0,
      open_interest: o.open_interest || 0, iv: o.iv || 0,
      delta: o.delta || 0, gamma: o.gamma || 0, theta: o.theta || 0,
      type: o.option?.includes('C') ? 'call' : 'put',
      expiration: o.expiration_date || '', strike: o.strike || 0,
    }))
  })
}

async function getExpirations(symbol: string): Promise<string[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_expirations', async () => {
    const data = await fetchJSON<any>(`${API}/${encodeURIComponent(symbol.toUpperCase())}.json`)
    const opts = data.data?.options || []
    const dates = [...new Set(opts.map((o: any) => o.expiration_date))] as string[]
    return dates.sort()
  })
}

async function getQuote(symbol: string): Promise<OptionQuote> {
  if (!symbol) throw new Error('Options symbol is required')
  return sg.wrap('get_quote', async () => {
    const base = symbol.slice(0, symbol.search(/\d/)).toUpperCase()
    const data = await fetchJSON<any>(`${API}/${encodeURIComponent(base)}.json`)
    const opt = (data.data?.options || []).find((o: any) => o.option === symbol.toUpperCase())
    if (!opt) throw new Error(`No quote found for ${symbol}`)
    return { symbol: opt.option, bid: opt.bid || 0, ask: opt.ask || 0, last: opt.last_sale_price || 0, volume: opt.volume || 0, open_interest: opt.open_interest || 0 }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getChain, getExpirations, getQuote }
console.log('settlegrid-options-data server started')
