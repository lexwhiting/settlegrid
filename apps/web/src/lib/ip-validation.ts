const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/

export function isValidIpOrCidr(value: string): boolean {
  return IPV4_RE.test(value) || IPV6_RE.test(value)
}

/**
 * Convert IPv4 address string to 32-bit integer for bitwise comparison.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  // Use unsigned right shift (>>> 0) to force unsigned 32-bit integer
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/**
 * Check if an IP matches a CIDR range using proper bitwise comparison.
 */
function matchesCidr(ip: string, cidr: string): boolean {
  const [networkIp, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false

  const ipInt = ipv4ToInt(ip)
  const networkInt = ipv4ToInt(networkIp)

  // Create subnet mask: for prefix=24 -> 0xFFFFFF00
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0

  return (ipInt & mask) === (networkInt & mask)
}

export function isIpInAllowlist(ip: string, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true

  return allowlist.some((entry) => {
    if (entry.includes('/')) {
      // CIDR range — only supports IPv4 CIDR for now
      if (IPV4_RE.test(ip) && IPV4_RE.test(entry)) {
        return matchesCidr(ip, entry)
      }
      // IPv6 CIDR: fall back to prefix match
      const prefix = entry.split('/')[0]
      return ip.startsWith(prefix)
    }
    // Exact match
    return ip === entry
  })
}
