/**
 * settlegrid-port-traffic — Port Traffic Data MCP Server
 *
 * Methods:
 *   get_port_info(port_code)         (1¢)
 *   search_ports(query)              (1¢)
 *   get_vessels_in_port(port_code)   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetPortInfoInput { port_code: string }
interface SearchPortsInput { query: string }
interface GetVesselsInput { port_code: string }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-port-traffic/1.0 (contact@settlegrid.ai)'

// Top 20 world ports for reference
const MAJOR_PORTS = [
  { code: 'CNSHA', name: 'Shanghai', country: 'China', teu_millions: 47.03 },
  { code: 'SGSIN', name: 'Singapore', country: 'Singapore', teu_millions: 37.2 },
  { code: 'CNNGB', name: 'Ningbo-Zhoushan', country: 'China', teu_millions: 33.3 },
  { code: 'CNSHE', name: 'Shenzhen', country: 'China', teu_millions: 29.0 },
  { code: 'CNQIN', name: 'Qingdao', country: 'China', teu_millions: 25.5 },
  { code: 'CNGSZ', name: 'Guangzhou', country: 'China', teu_millions: 24.2 },
  { code: 'KRPUS', name: 'Busan', country: 'South Korea', teu_millions: 22.7 },
  { code: 'CNTSN', name: 'Tianjin', country: 'China', teu_millions: 21.0 },
  { code: 'HKHKG', name: 'Hong Kong', country: 'Hong Kong', teu_millions: 16.2 },
  { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', teu_millions: 14.5 },
  { code: 'AEAUH', name: 'Jebel Ali', country: 'UAE', teu_millions: 14.1 },
  { code: 'MYTPP', name: 'Port Klang', country: 'Malaysia', teu_millions: 13.7 },
  { code: 'BEANR', name: 'Antwerp', country: 'Belgium', teu_millions: 12.0 },
  { code: 'CNXMN', name: 'Xiamen', country: 'China', teu_millions: 11.5 },
  { code: 'USNYC', name: 'New York/New Jersey', country: 'USA', teu_millions: 9.5 },
]

const sg = settlegrid.init({
  toolSlug: 'port-traffic',
  pricing: { defaultCostCents: 1, methods: {
    get_port_info: { costCents: 1, displayName: 'Get port info' },
    search_ports: { costCents: 1, displayName: 'Search ports' },
    get_vessels_in_port: { costCents: 2, displayName: 'Get vessels in port' },
  }},
})

const getPortInfo = sg.wrap(async (args: GetPortInfoInput) => {
  if (!args.port_code) throw new Error('port_code is required (UN/LOCODE e.g. CNSHA)')
  const code = args.port_code.toUpperCase().trim()
  const port = MAJOR_PORTS.find(p => p.code === code)
  if (!port) return { port_code: code, found: false, message: 'Port not in top-15 database. Try search_ports.' }
  return { ...port, found: true }
}, { method: 'get_port_info' })

const searchPorts = sg.wrap(async (args: SearchPortsInput) => {
  if (!args.query) throw new Error('query is required')
  const q = args.query.toLowerCase()
  const results = MAJOR_PORTS.filter(p => p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  return { query: args.query, count: results.length, results }
}, { method: 'search_ports' })

const getVesselsInPort = sg.wrap(async (args: GetVesselsInput) => {
  if (!args.port_code) throw new Error('port_code is required')
  const code = args.port_code.toUpperCase().trim()
  const ctry = code.slice(0, 2)
  const res = await fetch(`${API_BASE}/country/${ctry}/indicator/IS.SHP.GOOD.TU?date=2018:2022&format=json`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`World Bank API ${res.status}`)
  const data = await res.json()
  return { port_code: code, trade_data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_vessels_in_port' })

export { getPortInfo, searchPorts, getVesselsInPort }

console.log('settlegrid-port-traffic MCP server ready')
console.log('Methods: get_port_info, search_ports, get_vessels_in_port')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
