/**
 * Unit tests for the robust copy-to-clipboard helper.
 *
 * Per this project's testing convention (see
 * src/components/telemetry/__tests__/emitters.test.tsx), the web app does NOT
 * use jsdom — tests run in the `node` environment. `copyToClipboard` reads
 * the `navigator` / `window` / `document` globals, so we stub them per-case
 * with `vi.stubGlobal` and exercise each branch directly.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyToClipboard } from '../clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Stub a minimal `document` whose execCommand returns `execResult`. */
function stubDocumentWithExecCommand(execResult: boolean) {
  const textarea = {
    value: '',
    setAttribute: vi.fn(),
    style: {} as Record<string, string>,
    focus: vi.fn(),
    select: vi.fn(),
  }
  const doc = {
    createElement: vi.fn(() => textarea),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    execCommand: vi.fn(() => execResult),
  }
  vi.stubGlobal('document', doc)
  return { doc, textarea }
}

describe('copyToClipboard', () => {
  it('uses the async Clipboard API in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: true })

    const ok = await copyToClipboard('sg_pub_secret')

    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('sg_pub_secret')
  })

  it('does NOT touch execCommand when the async path succeeds', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    vi.stubGlobal('window', { isSecureContext: true })
    const { doc } = stubDocumentWithExecCommand(true)

    await copyToClipboard('k')

    expect(doc.execCommand).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: true })
    const { doc, textarea } = stubDocumentWithExecCommand(true)

    const ok = await copyToClipboard('k')

    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalled()
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
    expect(textarea.value).toBe('k')
    // Always cleans up the temporary element.
    expect(doc.body.removeChild).toHaveBeenCalled()
  })

  it('uses the execCommand fallback directly in an insecure context', async () => {
    vi.stubGlobal('navigator', {}) // no clipboard
    vi.stubGlobal('window', { isSecureContext: false })
    const { doc } = stubDocumentWithExecCommand(true)

    const ok = await copyToClipboard('k')

    expect(ok).toBe(true)
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when execCommand reports failure (and still cleans up)', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { isSecureContext: false })
    const { doc } = stubDocumentWithExecCommand(false)

    const ok = await copyToClipboard('k')

    expect(ok).toBe(false)
    expect(doc.body.removeChild).toHaveBeenCalled()
  })

  it('returns false (never throws) when neither clipboard nor document is available', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { isSecureContext: false })
    // `document` is left undefined (node default).

    await expect(copyToClipboard('k')).resolves.toBe(false)
  })
})
