/**
 * P4.6 — targets.ts tests.
 *
 * Pure-data module; only `isSendable()` has runtime logic. Tests
 * cover the four guard conditions (email present, contains @,
 * subject non-empty, body non-empty) plus the all-good case.
 */
import { describe, it, expect } from 'vitest'
import { isSendable, type DraftEmail } from '../targets'

const BASE_DRAFT: DraftEmail = {
  identity: {
    githubLogin: 'jane',
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  tier: 'hot',
  subject: 'SettleGrid is live',
  body: 'Hey Jane,\n\nA real body.\n\n— Lex',
  personalizationLine: 'A specific sentence.',
}

describe('isSendable', () => {
  it('returns true on a fully-populated draft', () => {
    expect(isSendable(BASE_DRAFT)).toBe(true)
  })
  it('returns false when email is null', () => {
    expect(
      isSendable({
        ...BASE_DRAFT,
        identity: { ...BASE_DRAFT.identity, email: null },
      }),
    ).toBe(false)
  })
  it('returns false when email lacks @', () => {
    expect(
      isSendable({
        ...BASE_DRAFT,
        identity: { ...BASE_DRAFT.identity, email: 'no-at-sign' },
      }),
    ).toBe(false)
  })
  it('returns false when subject is whitespace-only', () => {
    expect(isSendable({ ...BASE_DRAFT, subject: '   ' })).toBe(false)
  })
  it('returns false when body is whitespace-only', () => {
    expect(isSendable({ ...BASE_DRAFT, body: '\n\n   \n' })).toBe(false)
  })
  it('returns false when subject is empty string', () => {
    expect(isSendable({ ...BASE_DRAFT, subject: '' })).toBe(false)
  })
})
