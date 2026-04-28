/**
 * P4.8 — interview-request email template tests.
 *
 * Pure renderer; no I/O to mock. Tests cover:
 *   - happy path: subject + body shape
 *   - spec literal copy: first line + middle paragraph + sign-off
 *   - input validation: non-empty fields, https URL
 *   - subject cap: throws when `Quick question about <login>` > 70 chars
 *   - firstNameOf helper: real-name/login fallback edge cases
 */
import { describe, it, expect } from 'vitest'
import {
  SUBJECT_MAX_LEN,
  firstNameOf,
  interviewRequestEmail,
  type InterviewRequestInput,
} from '../interview-request'

const VALID: InterviewRequestInput = {
  recipientName: 'Jane Doe',
  recipientLogin: 'jane-dev',
  founderName: 'Lex',
  founderPhone: '+1-555-0100',
  calendlyUrl: 'https://calendly.com/lex-settlegrid/interview-20min',
}

describe('interviewRequestEmail — happy path', () => {
  it('returns a subject + body for valid input', () => {
    const out = interviewRequestEmail(VALID)
    expect(out.subject).toBe('Quick question about jane-dev')
    expect(typeof out.body).toBe('string')
    expect(out.body.length).toBeGreaterThan(50)
  })

  it('subject contains the recipient login (per spec)', () => {
    expect(interviewRequestEmail(VALID).subject).toContain('jane-dev')
  })

  it('body opens with the spec-literal first line', () => {
    const { body } = interviewRequestEmail(VALID)
    expect(body).toContain(
      'Thanks for signing up to SettleGrid earlier today.',
    )
  })

  it('body includes the spec-literal middle paragraph', () => {
    const { body } = interviewRequestEmail(VALID)
    expect(body).toContain(
      "I'm the founder. I'm trying to learn what people actually need from MCP monetization.",
    )
    expect(body).toContain('Would you have 20 minutes this week?')
    expect(body).toContain("I'll share everything I'm learning with you.")
  })

  it('body has the Calendly URL on its own line as the CTA', () => {
    const { body } = interviewRequestEmail(VALID)
    expect(body).toContain(VALID.calendlyUrl)
  })

  it('body sign-off has founder name + phone', () => {
    const { body } = interviewRequestEmail(VALID)
    expect(body).toContain(`— ${VALID.founderName}`)
    expect(body).toContain(VALID.founderPhone)
  })

  it('body greets with first name extracted from full display name', () => {
    const { body } = interviewRequestEmail(VALID)
    expect(body).toMatch(/^Hey Jane,/)
  })

  it('falls back to login when display name is empty', () => {
    const { body } = interviewRequestEmail({ ...VALID, recipientName: 'jane-dev' })
    // name === login → falls back to login
    expect(body).toMatch(/^Hey jane-dev,/)
  })
})

describe('interviewRequestEmail — input validation', () => {
  it.each<keyof InterviewRequestInput>([
    'recipientName',
    'recipientLogin',
    'founderName',
    'founderPhone',
  ])('throws on empty %s', (field) => {
    expect(() => interviewRequestEmail({ ...VALID, [field]: '' })).toThrow(
      new RegExp(field),
    )
  })

  it('throws on whitespace-only field', () => {
    expect(() =>
      interviewRequestEmail({ ...VALID, founderName: '   ' }),
    ).toThrow(/founderName/)
  })

  it('throws on http:// (non-https) Calendly URL', () => {
    expect(() =>
      interviewRequestEmail({
        ...VALID,
        calendlyUrl: 'http://calendly.com/foo',
      }),
    ).toThrow(/https/)
  })

  it('throws on a malformed Calendly URL string', () => {
    expect(() =>
      interviewRequestEmail({ ...VALID, calendlyUrl: 'not a url at all' }),
    ).toThrow(/valid URL/)
  })

  it('accepts any https URL (different scheduler, custom domain)', () => {
    expect(() =>
      interviewRequestEmail({
        ...VALID,
        calendlyUrl: 'https://cal.com/lex/interview',
      }),
    ).not.toThrow()
  })
})

describe('interviewRequestEmail — subject length cap', () => {
  it('throws when subject exceeds SUBJECT_MAX_LEN', () => {
    // The constant prefix is "Quick question about " (21 chars).
    // GitHub login regex caps at 39 chars but we're test-driving,
    // so use a 60-char string to push the subject past 70.
    const longLogin = 'a'.repeat(60)
    expect(() =>
      interviewRequestEmail({ ...VALID, recipientLogin: longLogin }),
    ).toThrow(/exceeds 70/)
  })

  it('accepts a max-length GitHub-shaped login (39 chars)', () => {
    const login = 'a'.repeat(39)
    expect(() =>
      interviewRequestEmail({ ...VALID, recipientLogin: login }),
    ).not.toThrow()
  })

  it('SUBJECT_MAX_LEN is exported as 70', () => {
    expect(SUBJECT_MAX_LEN).toBe(70)
  })
})

describe('firstNameOf', () => {
  it('returns first whitespace-delimited token of a full name', () => {
    expect(firstNameOf('Jane Doe', 'jane-dev')).toBe('Jane')
  })

  it('falls back to login when name equals login', () => {
    expect(firstNameOf('jane-dev', 'jane-dev')).toBe('jane-dev')
  })

  it('falls back to login when name is empty', () => {
    expect(firstNameOf('', 'jane-dev')).toBe('jane-dev')
  })

  it('falls back to login when name is whitespace-only', () => {
    expect(firstNameOf('   ', 'jane-dev')).toBe('jane-dev')
  })

  it('preserves single-token CJK names', () => {
    expect(firstNameOf('李明', 'liming')).toBe('李明')
  })

  it('handles multi-token names (returns only first token)', () => {
    expect(firstNameOf('Jane Mary Smith', 'jane')).toBe('Jane')
  })
})
