/**
 * P4.6 — render.ts tests.
 *
 * Covers: template token interpolation, tier-specific copy,
 * CAN-SPAM config validation, "Re:" subject rejection, first-name
 * extraction, review-block rendering.
 */
import { describe, it, expect } from 'vitest'
import {
  TIER_INTROS,
  TIER_LINES,
  assertCanSpamConfig,
  firstNameOf,
  readLaunchLiveTemplate,
  renderDraft,
  renderReviewBlock,
  type RenderConfig,
} from '../render'
import type { Target } from '../targets'

const CONFIG: RenderConfig = {
  founderName: 'Lex',
  founderRole: 'Founder',
  companyName: 'SettleGrid (Alerterra, LLC)',
  physicalAddress: '123 Example St, San Francisco, CA 94110',
  blogUrl: 'https://settlegrid.ai/learn/blog/settlegrid-templates-launch',
  galleryUrl: 'https://settlegrid.ai/templates',
  unsubscribeUrl: '',
}

const HOT_TARGET: Target = {
  tier: 'hot',
  identity: { githubLogin: 'jane-dev', name: 'Jane Doe', email: 'jane@example.com' },
  signal: {
    bio: null,
    recentRepoName: null,
    recentCommitMessage: null,
    primaryLanguage: null,
    recentActivityType: null,
    recentActivityTitle: null,
    starCount: null,
    forkedTemplateRepo: 'https://github.com/settlegrid/settlegrid-airbyte',
  },
}

describe('assertCanSpamConfig', () => {
  it('accepts a fully-populated config', () => {
    expect(() => assertCanSpamConfig(CONFIG)).not.toThrow()
  })
  it.each<keyof RenderConfig>([
    'founderName',
    'founderRole',
    'companyName',
    'physicalAddress',
    'blogUrl',
    'galleryUrl',
  ])('throws on missing %s', (key) => {
    const cfg = { ...CONFIG, [key]: '' }
    expect(() => assertCanSpamConfig(cfg)).toThrow(/CAN-SPAM/)
  })
  it('rejects http:// blog URL (forces https)', () => {
    expect(() =>
      assertCanSpamConfig({ ...CONFIG, blogUrl: 'http://example.com' }),
    ).toThrow(/https/)
  })
  it('rejects http:// gallery URL', () => {
    expect(() =>
      assertCanSpamConfig({ ...CONFIG, galleryUrl: 'http://example.com' }),
    ).toThrow(/https/)
  })
  it('accepts empty unsubscribeUrl (personal-email mode)', () => {
    expect(() =>
      assertCanSpamConfig({ ...CONFIG, unsubscribeUrl: '' }),
    ).not.toThrow()
  })
  it('rejects http:// unsubscribeUrl when set', () => {
    expect(() =>
      assertCanSpamConfig({
        ...CONFIG,
        unsubscribeUrl: 'http://example.com',
      }),
    ).toThrow(/https/)
  })
  it('rejects whitespace-only field', () => {
    expect(() =>
      assertCanSpamConfig({ ...CONFIG, physicalAddress: '   ' }),
    ).toThrow(/CAN-SPAM/)
  })
})

describe('firstNameOf', () => {
  it('returns first whitespace-delimited token', () => {
    expect(firstNameOf('Lex Whiting', 'lexwhiting')).toBe('Lex')
  })
  it('falls back to login when name equals login', () => {
    expect(firstNameOf('lexwhiting', 'lexwhiting')).toBe('lexwhiting')
  })
  it('falls back to login on empty name', () => {
    expect(firstNameOf('', 'lexwhiting')).toBe('lexwhiting')
  })
  it('preserves single-token CJK names', () => {
    expect(firstNameOf('李明', 'liming')).toBe('李明')
  })
})

describe('TIER_LINES', () => {
  it('hot variant references the forked repo by owner/name slug', () => {
    const line = TIER_LINES.hot(HOT_TARGET)
    expect(line).toContain('settlegrid/settlegrid-airbyte')
  })
  it('hot variant has a fallback when forkedTemplateRepo is null', () => {
    const fallback = { ...HOT_TARGET, signal: { ...HOT_TARGET.signal, forkedTemplateRepo: null } }
    const line = TIER_LINES.hot(fallback)
    expect(line).toContain('your-mcp-server')
  })
  it('warm variant is generic + has no PII', () => {
    const line = TIER_LINES.warm(HOT_TARGET)
    expect(line).not.toContain('jane')
    expect(line.length).toBeGreaterThan(0)
  })
  it('cold variant returns empty string (cold "softener" lives in intro_context)', () => {
    const cold = { ...HOT_TARGET, tier: 'cold' as const }
    expect(TIER_LINES.cold(cold)).toBe('')
  })
})

describe('TIER_INTROS (per-tier opening context)', () => {
  it('hot intro references the prior Phase-2 contact', () => {
    expect(TIER_INTROS.hot).toContain('emailed you about SettleGrid 6 weeks ago')
  })
  it('warm intro hedges about prior contact', () => {
    expect(TIER_INTROS.warm).toContain('may have seen it')
  })
  it('cold intro acknowledges no prior contact', () => {
    expect(TIER_INTROS.cold).toContain('reaching out cold')
    expect(TIER_INTROS.cold).not.toContain('emailed you')
  })
})

describe('renderDraft', () => {
  const TEMPLATE = readLaunchLiveTemplate()

  it('produces a full draft with subject, body, identity', () => {
    const draft = renderDraft({
      target: HOT_TARGET,
      personalizationLine: 'A specific sentence about the recipient.',
      template: TEMPLATE,
      config: CONFIG,
    })
    expect(draft.subject).toBe(
      "SettleGrid is live — thought you'd want to see it",
    )
    expect(draft.body).toContain('Hey Jane')
    expect(draft.body).toContain('A specific sentence about the recipient.')
    expect(draft.body).toContain('settlegrid/settlegrid-airbyte') // hot tier line
    expect(draft.body).toContain(CONFIG.physicalAddress)
    expect(draft.body).toContain(CONFIG.companyName)
    expect(draft.body).toContain(CONFIG.founderName)
    expect(draft.body).toContain('Reply STOP')
    expect(draft.body).toContain(CONFIG.blogUrl)
    expect(draft.body).toContain(CONFIG.galleryUrl) // primary ask is gallery click
    expect(draft.identity).toEqual(HOT_TARGET.identity)
    expect(draft.tier).toBe('hot')
  })

  it('cold draft does NOT include "I emailed you 6 weeks ago" (factual accuracy)', () => {
    const cold = { ...HOT_TARGET, tier: 'cold' as const }
    const draft = renderDraft({
      target: cold,
      personalizationLine: 'A specific sentence.',
      template: TEMPLATE,
      config: CONFIG,
    })
    expect(draft.body).not.toContain('emailed you about SettleGrid 6 weeks ago')
    expect(draft.body).toContain('reaching out cold')
  })

  it('warm draft uses the hedged intro', () => {
    const warm = { ...HOT_TARGET, tier: 'warm' as const }
    const draft = renderDraft({
      target: warm,
      personalizationLine: 'A specific sentence.',
      template: TEMPLATE,
      config: CONFIG,
    })
    expect(draft.body).toContain('may have seen it')
  })

  it('renders unsubscribe link when configured', () => {
    const draft = renderDraft({
      target: HOT_TARGET,
      personalizationLine: 'Sentence.',
      template: TEMPLATE,
      config: { ...CONFIG, unsubscribeUrl: 'https://example.com/unsubscribe' },
    })
    expect(draft.body).toContain('Or unsubscribe at https://example.com/unsubscribe')
  })

  it('omits unsubscribe sentence when unsubscribeUrl is empty', () => {
    const draft = renderDraft({
      target: HOT_TARGET,
      personalizationLine: 'Sentence.',
      template: TEMPLATE,
      config: CONFIG,
    })
    expect(draft.body).not.toContain('Or unsubscribe at')
  })

  it('throws if subject starts with "Re:" (deceptive subject line)', () => {
    const badTemplate = TEMPLATE.replace(
      /^Subject: .*$/m,
      'Subject: Re: SettleGrid is live',
    )
    expect(() =>
      renderDraft({
        target: HOT_TARGET,
        personalizationLine: 'foo',
        template: badTemplate,
        config: CONFIG,
      }),
    ).toThrow(/Re:/)
  })

  it('throws when template is missing the Subject: line', () => {
    const malformed = 'Hey {{recipient_name}},\n\nNo subject here.'
    expect(() =>
      renderDraft({
        target: HOT_TARGET,
        personalizationLine: 'foo',
        template: malformed,
        config: CONFIG,
      }),
    ).toThrow(/Subject:/)
  })

  it('does NOT interpolate user-provided tokens recursively (hostile-fix verified)', () => {
    // Single-pass token substitution via renderTokens(). If the
    // personalization line contains literal `{{founder_name}}`
    // text, that text remains untouched in the output because
    // the substitution regex was constructed BEFORE the values
    // were inserted. Recursion vector closed.
    const draft = renderDraft({
      target: HOT_TARGET,
      personalizationLine: 'I saw your work on {{founder_name}}.',
      template: TEMPLATE,
      config: CONFIG,
    })
    expect(draft.body).toContain('I saw your work on {{founder_name}}.')
    expect(draft.body).not.toContain('I saw your work on Lex.')
  })
})

describe('renderReviewBlock', () => {
  const TEMPLATE = readLaunchLiveTemplate()

  it('renders a numbered, tier-tagged block with a sent checkbox', () => {
    const draft = renderDraft({
      target: HOT_TARGET,
      personalizationLine: 'A specific sentence.',
      template: TEMPLATE,
      config: CONFIG,
    })
    const block = renderReviewBlock(7, draft)
    expect(block).toContain('## Email 007 — HOT — Jane Doe (@jane-dev)')
    expect(block).toContain('- Recipient: jane@example.com')
    expect(block).toContain('- Sent: [ ]')
    expect(block.endsWith('---\n\n')).toBe(true)
  })

  it('flags missing email in the recipient line', () => {
    const draft = renderDraft({
      target: { ...HOT_TARGET, identity: { ...HOT_TARGET.identity, email: null } },
      personalizationLine: 'A specific sentence.',
      template: TEMPLATE,
      config: CONFIG,
    })
    const block = renderReviewBlock(1, draft)
    expect(block).toContain('(email missing — resolve before sending)')
  })
})
