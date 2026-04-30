/**
 * P4.6 — personalize.ts tests.
 *
 * Wire-shape integration coverage at the script ↔ Anthropic seam
 * (the Phase 3 lesson: capture the actual outbound request body
 * and assert key-set against the receiving contract). Plus
 * sanitizer + composer unit tests + error-path mapping.
 */
import Anthropic from '@anthropic-ai/sdk'
import { describe, it, expect, vi } from 'vitest'
import {
  PERSONALIZE_MODEL,
  PERSONALIZE_MAX_TOKENS,
  PERSONALIZE_WORD_CAP,
  SYSTEM_PROMPT,
  composeUserMessage,
  personalize,
  sanitizeLine,
} from '../personalize'

describe('sanitizeLine', () => {
  it('strips wrapping double quotes', () => {
    expect(sanitizeLine('"hello world"')).toBe('hello world')
  })
  it('strips wrapping curly quotes', () => {
    expect(sanitizeLine('“hello world”')).toBe('hello world')
  })
  it('strips Here is/Here\'s preamble', () => {
    expect(sanitizeLine("Here's a personalization sentence: foo bar.")).toBe(
      'foo bar.',
    )
    expect(sanitizeLine('Here is a sentence: foo bar.')).toBe('foo bar.')
  })
  it('strips Personalization: preamble', () => {
    expect(sanitizeLine('Personalization line: foo bar.')).toBe('foo bar.')
  })
  it('strips numbered-list prefix', () => {
    expect(sanitizeLine('1. foo bar baz.')).toBe('foo bar baz.')
  })
  it('hard-caps at 20 words and re-attaches a period', () => {
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')
    const out = sanitizeLine(long)
    expect(out.split(/\s+/)).toHaveLength(PERSONALIZE_WORD_CAP)
    expect(out.endsWith('.')).toBe(true)
  })
  it('preserves existing terminator on cap', () => {
    const long = Array.from({ length: 25 }, (_, i) =>
      i === 19 ? 'fin?' : `w${i}`,
    ).join(' ')
    const out = sanitizeLine(long)
    // The 20th word becomes "fin?" — terminator preserved, no extra period appended
    expect(out.endsWith('.')).toBe(false)
  })
  it('returns empty string for empty input', () => {
    expect(sanitizeLine('')).toBe('')
    expect(sanitizeLine('"  "')).toBe('')
  })
})

describe('composeUserMessage', () => {
  it('includes only fields that are set', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('github_login: jane')
    expect(msg).toContain('recent_repo: foo/bar')
    expect(msg).not.toContain('bio:')
    expect(msg).not.toContain('display_name:')
    expect(msg).not.toContain('recent_commit:')
    expect(msg).not.toContain('primary_language:')
  })
  it('JSON-stringifies the commit message (escapes embedded quotes)', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: 'fix "OOM" on 500MB',
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('recent_commit: "fix \\"OOM\\" on 500MB"')
  })
  it('truncates a long bio with internal spaces at the last word boundary', () => {
    // 25 words, no JSON-special chars. Truncate cap is 200, so the
    // word boundary cut path fires.
    const wordy = Array.from({ length: 25 }, (_, i) =>
      'word' + 'x'.repeat(8) + i,
    ).join(' ')
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: wordy,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    const bioLine = msg.split('\n').find((l) => l.startsWith('  bio:'))!
    // Should end with `…"` and the slice should not chop a word in
    // half — the last visible char before `…` should be a digit
    // (end of a wordN token).
    expect(bioLine.endsWith('…"')).toBe(true)
    const beforeEllipsis = bioLine.slice(-3, -2)
    expect(beforeEllipsis).toMatch(/[a-zA-Z0-9]/)
  })

  it('truncates long bio + commit message', () => {
    const longText = 'x'.repeat(1000)
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: longText,
        recentRepoName: 'foo/bar',
        recentCommitMessage: longText,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    // Bio + commit are JSON-stringified (HC3 prompt-injection
    // defense) and truncated, so they end with `…"` (ellipsis +
    // closing quote).
    const bioLine = msg.split('\n').find((l) => l.startsWith('  bio:'))!
    expect(bioLine.length).toBeLessThan(220)
    expect(bioLine.endsWith('…"')).toBe(true)
  })

  it('includes recent_pr_title when activity is a PR', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: 'old commit',
        primaryLanguage: null,
        recentActivityType: 'PR',
        recentActivityTitle: 'Switch to streaming parser',
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('recent_pr_title: "Switch to streaming parser"')
    // PR/issue title takes priority over commit; commit must NOT appear.
    expect(msg).not.toContain('recent_commit:')
  })
  it('includes recent_issue_title when activity is an issue', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: 'issue',
        recentActivityTitle: 'Harmonize HS-6 codes',
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('recent_issue_title: "Harmonize HS-6 codes"')
  })
  it('includes primary_language when set', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: 'TypeScript',
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('primary_language: TypeScript')
  })
  it('JSON-stringifies display_name (HC3 — handles names with quotes/newlines)', () => {
    const msg = composeUserMessage(
      {
        githubLogin: 'jane',
        // Pathological name: embedded quote + newline
        name: 'O\'Brien\n"Robert"',
        email: null,
      },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('display_name: "O\'Brien\\n\\"Robert\\""')
  })
  it('wraps untrusted data in <untrusted_data> markers (HC2 prompt-injection defense)', () => {
    const msg = composeUserMessage(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
    )
    expect(msg).toContain('<untrusted_data>')
    expect(msg).toContain('</untrusted_data>')
    // Marker order: opening must precede the data, closing must follow.
    const open = msg.indexOf('<untrusted_data>')
    const githubLine = msg.indexOf('  github_login:')
    const close = msg.indexOf('</untrusted_data>')
    expect(open).toBeGreaterThanOrEqual(0)
    expect(githubLine).toBeGreaterThan(open)
    expect(close).toBeGreaterThan(githubLine)
  })
})

describe('personalize — wire shape against the Anthropic SDK', () => {
  function makeMockClient(opts: {
    onCreate: (params: unknown) => unknown
  }) {
    return {
      messages: {
        create: vi.fn(async (params: unknown) => opts.onCreate(params)),
      },
    } as unknown as Parameters<typeof personalize>[2] extends infer T
      ? T extends { client?: infer C }
        ? C
        : never
      : never
  }

  it('passes the documented body shape to messages.create', async () => {
    let captured: Record<string, unknown> | null = null
    const client = makeMockClient({
      onCreate: (params) => {
        captured = params as Record<string, unknown>
        return {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'A specific personalization line.' }],
        }
      },
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: true, line: 'A specific personalization line.' })
    expect(captured).not.toBeNull()
    const params = captured!
    expect(params.model).toBe(PERSONALIZE_MODEL)
    expect(params.max_tokens).toBe(PERSONALIZE_MAX_TOKENS)
    // System is an array with one cached text block
    expect(Array.isArray(params.system)).toBe(true)
    const sys = (params.system as Array<Record<string, unknown>>)[0]
    expect(sys.type).toBe('text')
    expect(sys.text).toBe(SYSTEM_PROMPT)
    expect(sys.cache_control).toEqual({ type: 'ephemeral' })
    // Single user message
    const messages = params.messages as Array<Record<string, unknown>>
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(typeof messages[0].content).toBe('string')
  })

  it('returns ok=false reason=model_refused when stop_reason=refusal', async () => {
    const client = makeMockClient({
      onCreate: () => ({ stop_reason: 'refusal', content: [] }),
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'model_refused' })
  })

  it('returns ok=false reason=empty_response on whitespace-only output', async () => {
    const client = makeMockClient({
      onCreate: () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '   ' }],
      }),
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'empty_response' })
  })

  it('returns ok=true with sanitized line (strips wrapping quotes + caps words)', async () => {
    const noisy = '"' + Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ') + '"'
    const client = makeMockClient({
      onCreate: () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: noisy }],
      }),
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.line.startsWith('"')).toBe(false)
    expect(result.line.split(/\s+/)).toHaveLength(PERSONALIZE_WORD_CAP)
  })

  it('returns ok=false reason=rate_limited on real Anthropic.RateLimitError', async () => {
    // Use the real SDK class so the instanceof branch fires.
    // Constructor: (status, errorBody, message, headers, type?)
    const err = new Anthropic.RateLimitError(
      429,
      { type: 'rate_limit_error', message: 'rate limited' },
      'rate limited',
      new Headers(),
    )
    const client = makeMockClient({
      onCreate: () => {
        throw err
      },
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('returns ok=false reason=api_error_<status> on real Anthropic.APIError', async () => {
    // BadRequestError extends APIError<400>. Tests that the
    // generic APIError branch correctly emits the status code.
    const err = new Anthropic.BadRequestError(
      400,
      { type: 'invalid_request_error', message: 'bad' },
      'bad request',
      new Headers(),
    )
    const client = makeMockClient({
      onCreate: () => {
        throw err
      },
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'api_error_400' })
  })

  it('returns ok=false reason=unknown_error on plain Error', async () => {
    const client = makeMockClient({
      onCreate: () => {
        throw new Error('unexpected network failure or generic crash')
      },
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    // Truncated to ≤ 80 chars; reason carries the underlying message.
    expect(result.reason).toContain('unexpected network failure')
    expect(result.reason.length).toBeLessThanOrEqual(80)
  })

  it('returns ok=false reason=sanitized_to_empty when output sanitizes to empty', async () => {
    // Wrapping quotes alone — sanitizeLine strips them, leaving
    // an empty string. The `if (!line)` branch catches this.
    const client = makeMockClient({
      onCreate: () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '"  "' }],
      }),
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'sanitized_to_empty' })
  })

  it('returns ok=false reason=unknown_error when a non-Error value is thrown', async () => {
    // Pathological case: someone throws a string literal. The
    // `err instanceof Error ? ... : 'unknown_error'` ternary's
    // false branch fires.
    const client = makeMockClient({
      onCreate: () => {
        throw 'a bare string, not an Error'
      },
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'unknown_error' })
  })

  it('returns ok=false reason=empty_response when response has no text block', async () => {
    // e.g. a thinking-only response.
    const client = makeMockClient({
      onCreate: () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: 'reasoning…' }],
      }),
    })
    const result = await personalize(
      { githubLogin: 'jane', name: 'jane', email: null },
      {
        bio: null,
        recentRepoName: 'foo/bar',
        recentCommitMessage: null,
        primaryLanguage: null,
        recentActivityType: null,
        recentActivityTitle: null,
        starCount: null,
        forkedTemplateRepo: null,
      },
      { client },
    )
    expect(result).toEqual({ ok: false, reason: 'empty_response' })
  })
})
