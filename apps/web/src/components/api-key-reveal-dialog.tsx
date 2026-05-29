'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check, KeyRound, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { copyToClipboard } from '@/lib/clipboard'

export interface ApiKeyRevealDialogProps {
  /** The one-time secret to reveal. `null`/empty keeps the dialog closed. */
  apiKey: string | null
  /** Optional label the user gave the key, shown for confirmation. */
  keyLabel?: string
  /** Called when the user dismisses (Done button or Esc). */
  onClose: () => void
}

/**
 * One-time API-key reveal modal.
 *
 * The key is shown exactly once (it is hashed server-side and cannot be
 * retrieved again), so this surface follows the pattern leading dashboards
 * use for unrecoverable secrets:
 *   - commands attention (focus-trapped Radix dialog over a dimmed page);
 *   - suppresses click-outside dismissal so a stray click can't destroy the
 *     key — Esc still closes it, per the WAI-ARIA APG dialog pattern;
 *   - decouples Copy from Dismiss (Copy gives feedback and leaves the modal
 *     open; the user closes explicitly once the key is stored);
 *   - never loses the key on a failed copy (keeps it visible + selectable
 *     and instructs a manual copy).
 */
export function ApiKeyRevealDialog({
  apiKey,
  keyLabel,
  onClose,
}: ApiKeyRevealDialogProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset transient copy state each time a new key is revealed.
  useEffect(() => {
    if (apiKey) {
      setCopied(false)
      setHasCopied(false)
    }
  }, [apiKey])

  // Clear any pending "Copied → Copy" reset timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  async function handleCopy() {
    if (!apiKey) return
    const ok = await copyToClipboard(apiKey)
    if (ok) {
      setCopied(true)
      setHasCopied(true)
      toast('API key copied to clipboard.', 'success')
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 2000)
    } else {
      // The key is unrecoverable — never close on a failed copy. Keep it on
      // screen (it is `select-all`) and tell the user to copy it manually.
      toast(
        'Could not copy automatically — select the key and copy it manually before closing.',
        'error',
      )
    }
  }

  return (
    <Dialog
      open={Boolean(apiKey)}
      onOpenChange={(open) => {
        // Fires for user-initiated close gestures (Esc). Outside-click is
        // suppressed below; the Done button drives `onClose` directly.
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="max-w-md"
        // Suppress click-outside / pointer-down-outside dismissal so a stray
        // click can't destroy an unrecoverable secret. Esc still closes.
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand" aria-hidden="true" />
            Save your API key
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This is the only time you&apos;ll see this key. Copy it and store
              it somewhere safe — you won&apos;t be able to view it again.
            </span>
          </DialogDescription>
        </DialogHeader>

        {keyLabel ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Label ·{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {keyLabel}
            </span>
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 select-all break-all rounded-md bg-gray-100 px-3 py-2 font-mono text-xs text-gray-800 dark:bg-[#252836] dark:text-gray-200"
            aria-label="Your new API key"
          >
            {apiKey}
          </code>
          <Button
            type="button"
            onClick={handleCopy}
            autoFocus
            className="shrink-0"
            aria-label={copied ? 'API key copied' : 'Copy API key'}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400" aria-live="polite">
            {hasCopied ? '' : "You haven't copied your key yet."}
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            I&apos;ve saved it — Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
