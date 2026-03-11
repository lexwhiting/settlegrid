const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/

export function isValidIpOrCidr(value: string): boolean {
  return IPV4_RE.test(value) || IPV6_RE.test(value)
}

export function isIpInAllowlist(ip: string, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true
  // Exact match check (CIDR expansion would require a library)
  return allowlist.some(entry => {
    if (entry.includes('/')) {
      // Simple prefix match for CIDR (basic approximation)
      const prefix = entry.split('/')[0]
      return ip.startsWith(prefix.split('.').slice(0, -1).join('.'))
    }
    return ip === entry
  })
}
