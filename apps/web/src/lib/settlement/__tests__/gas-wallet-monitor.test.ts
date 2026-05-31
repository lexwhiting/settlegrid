/**
 * B1.3 — gas-balance classifier. Pure boundary logic for the gas-wallet
 * monitor; the I/O (`readGasWalletBalanceEth`) is exercised via the cron
 * handler test with this seam mocked.
 */
import { describe, it, expect } from 'vitest'
import { classifyGasBalance } from '../gas-wallet-monitor'

const T = { warnEth: 0.004, criticalEth: 0.0015 }

describe('classifyGasBalance', () => {
  it('ok when comfortably above WARN', () => {
    expect(classifyGasBalance('0.01', T)).toBe('ok')
    expect(classifyGasBalance('1', T)).toBe('ok')
  })

  it('ok exactly AT the WARN threshold (strict <)', () => {
    expect(classifyGasBalance('0.004', T)).toBe('ok')
  })

  it('warn just below WARN but above CRITICAL', () => {
    expect(classifyGasBalance('0.0039', T)).toBe('warn')
    expect(classifyGasBalance('0.002', T)).toBe('warn')
  })

  it('warn exactly AT the CRITICAL threshold (strict <)', () => {
    expect(classifyGasBalance('0.0015', T)).toBe('warn')
  })

  it('critical just below CRITICAL', () => {
    expect(classifyGasBalance('0.0014', T)).toBe('critical')
    expect(classifyGasBalance('0', T)).toBe('critical')
  })

  it('fails SAFE: an unparseable balance is critical, never ok', () => {
    expect(classifyGasBalance('not-a-number', T)).toBe('critical')
    expect(classifyGasBalance('NaN', T)).toBe('critical')
  })
})
