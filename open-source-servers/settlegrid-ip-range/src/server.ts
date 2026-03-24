/**
 * settlegrid-ip-range — IP Range / CIDR Calculator MCP Server
 *
 * Calculate IP ranges, subnets, and CIDR notation. All local computation.
 *
 * Methods:
 *   parse_cidr(cidr) — Parse CIDR notation (free)
 *   ip_in_range(ip, cidr) — Check if IP is in CIDR range (free)
 *   subnet_info(ip, mask) — Get subnet information (free)
 *   ip_to_int(ip) — Convert IP to integer (free)
 *   int_to_ip(int) — Convert integer to IP (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CidrInput { cidr: string }
interface RangeCheckInput { ip: string; cidr: string }
interface SubnetInput { ip: string; mask: number }
interface IpInput { ip: string }
interface IntInput { int: number }

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: ${ip}`)
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(int: number): string {
  return `${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}`
}

function parseCidrNotation(cidr: string): { ip: string; prefix: number; networkInt: number; broadcastInt: number } {
  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error(`Invalid prefix length: ${prefixStr}`)
  const ipInt = ipToInt(ip)
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  const networkInt = (ipInt & mask) >>> 0
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0
  return { ip, prefix, networkInt, broadcastInt }
}

const PRIVATE_RANGES = [
  { cidr: '10.0.0.0/8', name: 'Class A Private' },
  { cidr: '172.16.0.0/12', name: 'Class B Private' },
  { cidr: '192.168.0.0/16', name: 'Class C Private' },
  { cidr: '127.0.0.0/8', name: 'Loopback' },
  { cidr: '169.254.0.0/16', name: 'Link-Local' },
]

function isPrivate(ip: string): { isPrivate: boolean; range: string | null } {
  const ipInt = ipToInt(ip)
  for (const r of PRIVATE_RANGES) {
    const parsed = parseCidrNotation(r.cidr)
    if (ipInt >= parsed.networkInt && ipInt <= parsed.broadcastInt) {
      return { isPrivate: true, range: r.name }
    }
  }
  return { isPrivate: false, range: null }
}

const sg = settlegrid.init({
  toolSlug: 'ip-range',
  pricing: {
    defaultCostCents: 0,
    methods: {
      parse_cidr: { costCents: 0, displayName: 'Parse CIDR' },
      ip_in_range: { costCents: 0, displayName: 'IP in Range' },
      subnet_info: { costCents: 0, displayName: 'Subnet Info' },
      ip_to_int: { costCents: 0, displayName: 'IP to Integer' },
      int_to_ip: { costCents: 0, displayName: 'Integer to IP' },
    },
  },
})

const parseCidr = sg.wrap(async (args: CidrInput) => {
  if (!args.cidr) throw new Error('cidr required (e.g., 192.168.1.0/24)')
  const { ip, prefix, networkInt, broadcastInt } = parseCidrNotation(args.cidr)
  const hostCount = broadcastInt - networkInt - 1
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return {
    cidr: args.cidr,
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    netmask: intToIp(mask),
    wildcardMask: intToIp((~mask) >>> 0),
    firstHost: prefix >= 31 ? intToIp(networkInt) : intToIp(networkInt + 1),
    lastHost: prefix >= 31 ? intToIp(broadcastInt) : intToIp(broadcastInt - 1),
    hostCount: Math.max(0, hostCount),
    totalAddresses: broadcastInt - networkInt + 1,
    prefix,
    ...isPrivate(ip),
  }
}, { method: 'parse_cidr' })

const ipInRange = sg.wrap(async (args: RangeCheckInput) => {
  if (!args.ip || !args.cidr) throw new Error('ip and cidr required')
  const ipInt = ipToInt(args.ip)
  const { networkInt, broadcastInt } = parseCidrNotation(args.cidr)
  const inRange = ipInt >= networkInt && ipInt <= broadcastInt
  return { ip: args.ip, cidr: args.cidr, inRange }
}, { method: 'ip_in_range' })

const subnetInfo = sg.wrap(async (args: SubnetInput) => {
  if (!args.ip || args.mask === undefined) throw new Error('ip and mask required')
  return parseCidr.fn({ cidr: `${args.ip}/${args.mask}` } as CidrInput)
}, { method: 'subnet_info' })

const ipToIntMethod = sg.wrap(async (args: IpInput) => {
  if (!args.ip) throw new Error('ip required')
  const int = ipToInt(args.ip)
  return { ip: args.ip, integer: int, hex: '0x' + int.toString(16).padStart(8, '0'), binary: int.toString(2).padStart(32, '0'), ...isPrivate(args.ip) }
}, { method: 'ip_to_int' })

const intToIpMethod = sg.wrap(async (args: IntInput) => {
  if (args.int === undefined) throw new Error('int required')
  const ip = intToIp(args.int >>> 0)
  return { integer: args.int, ip, ...isPrivate(ip) }
}, { method: 'int_to_ip' })

export { parseCidr, ipInRange, subnetInfo, ipToIntMethod, intToIpMethod }

console.log('settlegrid-ip-range MCP server ready')
console.log('Methods: parse_cidr, ip_in_range, subnet_info, ip_to_int, int_to_ip')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
