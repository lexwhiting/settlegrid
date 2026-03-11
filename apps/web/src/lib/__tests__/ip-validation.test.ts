import { describe, it, expect } from 'vitest'
import { isIpInAllowlist, isValidIpOrCidr } from '../ip-validation'

describe('IP Validation', () => {
  describe('isValidIpOrCidr', () => {
    it('validates IPv4 addresses', () => {
      expect(isValidIpOrCidr('192.168.1.1')).toBe(true)
      expect(isValidIpOrCidr('10.0.0.1')).toBe(true)
      expect(isValidIpOrCidr('not-an-ip')).toBe(false)
    })

    it('validates IPv4 CIDR notation', () => {
      expect(isValidIpOrCidr('192.168.1.0/24')).toBe(true)
      expect(isValidIpOrCidr('10.0.0.0/8')).toBe(true)
    })

    it('validates IPv6 addresses', () => {
      expect(isValidIpOrCidr('::1')).toBe(true)
      expect(isValidIpOrCidr('fe80::1')).toBe(true)
    })
  })

  describe('isIpInAllowlist', () => {
    it('returns true for empty allowlist', () => {
      expect(isIpInAllowlist('192.168.1.1', [])).toBe(true)
    })

    it('matches exact IP', () => {
      expect(isIpInAllowlist('192.168.1.1', ['192.168.1.1'])).toBe(true)
      expect(isIpInAllowlist('192.168.1.2', ['192.168.1.1'])).toBe(false)
    })

    it('matches /24 CIDR range', () => {
      expect(isIpInAllowlist('192.168.1.100', ['192.168.1.0/24'])).toBe(true)
      expect(isIpInAllowlist('192.168.1.255', ['192.168.1.0/24'])).toBe(true)
      expect(isIpInAllowlist('192.168.2.1', ['192.168.1.0/24'])).toBe(false)
    })

    it('matches /16 CIDR range', () => {
      expect(isIpInAllowlist('10.0.50.100', ['10.0.0.0/16'])).toBe(true)
      expect(isIpInAllowlist('10.1.0.1', ['10.0.0.0/16'])).toBe(false)
    })

    it('matches /8 CIDR range', () => {
      expect(isIpInAllowlist('10.50.100.200', ['10.0.0.0/8'])).toBe(true)
      expect(isIpInAllowlist('11.0.0.1', ['10.0.0.0/8'])).toBe(false)
    })

    it('handles multiple allowlist entries', () => {
      const allowlist = ['192.168.1.0/24', '10.0.0.1']
      expect(isIpInAllowlist('192.168.1.50', allowlist)).toBe(true)
      expect(isIpInAllowlist('10.0.0.1', allowlist)).toBe(true)
      expect(isIpInAllowlist('172.16.0.1', allowlist)).toBe(false)
    })

    it('returns true for null/undefined allowlist', () => {
      expect(isIpInAllowlist('192.168.1.1', null as unknown as string[])).toBe(true)
    })
  })
})
