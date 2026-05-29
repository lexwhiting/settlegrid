/**
 * Robust copy-to-clipboard with a secure-context-aware fallback.
 *
 * `navigator.clipboard` is only defined in a secure context (HTTPS, or
 * localhost for dev); on plain HTTP it is `undefined`. Production
 * settlegrid.ai is HTTPS so the async path is the norm, but local/preview
 * over HTTP and older browsers need the legacy `document.execCommand('copy')`
 * fallback.
 *
 * Contract: this NEVER throws. It resolves `false` on any failure so callers
 * revealing an unrecoverable secret (e.g. a one-time API key) can keep it on
 * screen for manual copy instead of losing it.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Preferred path: async Clipboard API, only available in a secure context.
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied / transient failure — fall through to the
      // execCommand fallback rather than giving up on the copy.
    }
  }

  // Fallback: off-screen textarea + the deprecated-but-universally-present
  // execCommand('copy'). Synchronous and requires a document.
  if (typeof document === 'undefined') return false
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    // Keep it visually inert and stop focus()/select() from scrolling.
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.padding = '0'
    textarea.style.border = 'none'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    try {
      textarea.focus({ preventScroll: true })
      textarea.select()
      return document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  } catch {
    return false
  }
}
