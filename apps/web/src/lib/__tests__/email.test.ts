import { describe, it, expect } from 'vitest'
import {
  welcomeDeveloperEmail,
  stripeConnectCompleteEmail,
  payoutNotificationEmail,
  lowBalanceAlertEmail,
  creditPurchaseConfirmationEmail,
} from '@/lib/email'

describe('welcomeDeveloperEmail', () => {
  it('generates correct subject line', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.subject).toBe('Welcome to SettleGrid — Start monetizing your tools')
  })

  it('includes developer name in HTML body', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('Alice')
  })

  it('includes base layout structure', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
    expect(result.html).toContain('settlegrid.ai')
    expect(result.html).toContain('All rights reserved')
  })

  it('escapes HTML characters in name', () => {
    const result = welcomeDeveloperEmail('<script>alert("xss")</script>')
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('includes dashboard link', () => {
    const result = welcomeDeveloperEmail('Bob')
    expect(result.html).toContain('https://settlegrid.ai/dashboard')
  })
})

describe('stripeConnectCompleteEmail', () => {
  it('generates correct subject line', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.subject).toContain('Stripe Connect')
    expect(result.subject).toContain('active')
  })

  it('includes developer name in body', () => {
    const result = stripeConnectCompleteEmail('Carol')
    expect(result.html).toContain('Carol')
  })

  it('includes base template wrapper', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })
})

describe('payoutNotificationEmail', () => {
  it('generates subject with formatted amount', () => {
    const result = payoutNotificationEmail('Dev', 5000)
    expect(result.subject).toContain('$50.00')
  })

  it('includes formatted amount in body', () => {
    const result = payoutNotificationEmail('Dev', 2500)
    expect(result.html).toContain('$25.00')
  })

  it('includes payouts link', () => {
    const result = payoutNotificationEmail('Dev', 1000)
    expect(result.html).toContain('https://settlegrid.ai/dashboard/payouts')
  })

  it('escapes name in body', () => {
    const result = payoutNotificationEmail('O\'Brien & Co', 1000)
    expect(result.html).toContain('O&#39;Brien &amp; Co')
  })
})

describe('lowBalanceAlertEmail', () => {
  it('generates subject with tool name and balance', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'MyTool', 300)
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('$3.00')
  })

  it('includes consumer link', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'MyTool', 300)
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })

  it('escapes tool name in body', () => {
    const result = lowBalanceAlertEmail('user@test.com', '<b>Bad</b>', 100)
    expect(result.html).not.toContain('<b>Bad</b>')
    expect(result.html).toContain('&lt;b&gt;Bad&lt;/b&gt;')
  })
})

describe('creditPurchaseConfirmationEmail', () => {
  it('generates subject with amount and tool name', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 2000, 'AnalyzeTool')
    expect(result.subject).toContain('$20.00')
    expect(result.subject).toContain('AnalyzeTool')
  })

  it('includes base template in HTML', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 1000, 'Tool')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('includes consumer link', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 500, 'Tool')
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })
})
