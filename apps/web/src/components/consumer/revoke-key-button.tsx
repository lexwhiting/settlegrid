'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface RevokeKeyButtonProps {
  keyPrefix: string
  /** Revokes the key. Called only after the user confirms. */
  onConfirm: () => Promise<void> | void
}

/**
 * Revoke button with an inline confirmation step (same pattern as the
 * account deletion confirm on the consumer dashboard). Cancel takes focus
 * when the confirmation opens, and Escape dismisses it.
 */
export function RevokeKeyButton({ keyPrefix, onConfirm }: RevokeKeyButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [revoking, setRevoking] = useState(false)

  if (!confirming) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setConfirming(true)} aria-label={`Revoke API key ${keyPrefix}`}>
        Revoke
      </Button>
    )
  }

  const promptId = `revoke-key-prompt-${keyPrefix}`

  async function handleConfirm() {
    setRevoking(true)
    try {
      await onConfirm()
    } finally {
      setRevoking(false)
      setConfirming(false)
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={promptId}
      className="flex flex-wrap items-center justify-end gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !revoking) setConfirming(false)
      }}
    >
      <span id={promptId} className="text-xs text-red-700 dark:text-red-300">
        Revoke {keyPrefix}...? Requests using this key will be rejected.
      </span>
      <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={revoking}>
        {revoking ? 'Revoking...' : 'Revoke key'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={revoking} autoFocus>
        Cancel
      </Button>
    </div>
  )
}
