/**
 * B1.3 — gas-balance-check cron handler. Verifies the alert actually fires when
 * the balance is low (the cron's whole purpose; silent non-alerting → frozen
 * settlements) and the cron-secret auth gating. The viem balance read is mocked
 * at the gas-wallet-monitor seam; the REAL classifyGasBalance runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckRateLimit,
  mockGetCronSecret,
  mockSendEmail,
  mockReadBalance,
  mockGasWalletLowEmail,
} = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockGetCronSecret: vi.fn(),
  mockSendEmail: vi.fn(),
  mockReadBalance: vi.fn(),
  mockGasWalletLowEmail: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('@/lib/env', () => ({ getCronSecret: mockGetCronSecret, getBaseRpcUrl: vi.fn(() => undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/email', () => ({ sendEmail: mockSendEmail, gasWalletLowEmail: mockGasWalletLowEmail }))
// Partial mock: keep the REAL classifyGasBalance, replace only the I/O seam.
vi.mock('@/lib/settlement/gas-wallet-monitor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/settlement/gas-wallet-monitor')>()
  return { ...actual, readGasWalletBalanceEth: mockReadBalance }
})

import { GET } from '../route'

function req(auth?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (auth) headers['authorization'] = auth
  return new NextRequest('http://localhost/api/cron/gas-balance-check', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  mockGetCronSecret.mockReturnValue('test-secret')
  mockSendEmail.mockResolvedValue(undefined)
  mockGasWalletLowEmail.mockReturnValue({ subject: 'low', html: '<p>low</p>' })
})

describe('gas-balance-check cron — auth', () => {
  it('401 without the cron-secret bearer (and never reads the balance)', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockReadBalance).not.toHaveBeenCalled()
  })

  it('500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await GET(req('Bearer anything'))
    expect(res.status).toBe(500)
  })
})

describe('gas-balance-check cron — alerting', () => {
  it('emails the founder when the balance is below WARN', async () => {
    mockReadBalance.mockResolvedValue({ address: '0xabc', balanceWei: 1n, balanceEth: '0.003' })
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.level).toBe('warn')
    expect(body.alerted).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockGasWalletLowEmail).toHaveBeenCalledWith('lexwhiting@gmail.com', '0.003', 'Base mainnet')
  })

  it('emails when CRITICAL', async () => {
    mockReadBalance.mockResolvedValue({ address: '0xabc', balanceWei: 1n, balanceEth: '0.0005' })
    const res = await GET(req('Bearer test-secret'))
    const body = await res.json()
    expect(body.level).toBe('critical')
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it('does NOT email when the balance is healthy', async () => {
    mockReadBalance.mockResolvedValue({ address: '0xabc', balanceWei: 1n, balanceEth: '0.02' })
    const res = await GET(req('Bearer test-secret'))
    const body = await res.json()
    expect(body.level).toBe('ok')
    expect(body.alerted).toBe(false)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does nothing (checked:false, no email) when the gas wallet is unconfigured', async () => {
    mockReadBalance.mockResolvedValue(null)
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(false)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
