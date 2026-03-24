/**
 * settlegrid-threat-feeds — Open Threat Intelligence MCP Server
 *
 * Aggregates open-source threat intelligence feeds with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_emerging_threats()                (1¢)
 *   get_tor_exits()                       (1¢)
 *   get_feodo_botnet()                    (1¢)
 *   get_ssl_blacklist()                   (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

const USER_AGENT = "settlegrid-threat-feeds/1.0 (contact@settlegrid.ai)"

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Feed fetch ${res.status}: ${url}`)
  return res.text()
}

function parseIpList(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && /^\d/.test(l))
}

const sg = settlegrid.init({
  toolSlug: "threat-feeds",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_emerging_threats: { costCents: 1, displayName: "Get emerging threat rules" },
      get_tor_exits: { costCents: 1, displayName: "Get Tor exit node IPs" },
      get_feodo_botnet: { costCents: 1, displayName: "Get Feodo botnet C&C IPs" },
      get_ssl_blacklist: { costCents: 1, displayName: "Get SSL certificate blacklist" },
    },
  },
})

const getEmergingThreats = sg.wrap(async () => {
  const text = await fetchText("https://rules.emergingthreats.net/blockrules/compromised-ips.txt")
  const ips = parseIpList(text)
  return { source: "Emerging Threats", type: "compromised_ips", count: ips.length, ips: ips.slice(0, 500) }
}, { method: "get_emerging_threats" })

const getTorExits = sg.wrap(async () => {
  const text = await fetchText("https://check.torproject.org/torbulkexitlist")
  const ips = parseIpList(text)
  return { source: "Tor Project", type: "exit_nodes", count: ips.length, ips: ips.slice(0, 500) }
}, { method: "get_tor_exits" })

const getFeodoBotnet = sg.wrap(async () => {
  const text = await fetchText("https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt")
  const ips = parseIpList(text)
  return { source: "Feodo Tracker (abuse.ch)", type: "botnet_c2", count: ips.length, ips: ips.slice(0, 500) }
}, { method: "get_feodo_botnet" })

const getSslBlacklist = sg.wrap(async () => {
  const text = await fetchText("https://sslbl.abuse.ch/blacklist/sslipblacklist.txt")
  const ips = parseIpList(text)
  return { source: "SSL Blacklist (abuse.ch)", type: "ssl_blacklist", count: ips.length, ips: ips.slice(0, 500) }
}, { method: "get_ssl_blacklist" })

export { getEmergingThreats, getTorExits, getFeodoBotnet, getSslBlacklist }

console.log("settlegrid-threat-feeds MCP server ready")
console.log("Methods: get_emerging_threats, get_tor_exits, get_feodo_botnet, get_ssl_blacklist")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
