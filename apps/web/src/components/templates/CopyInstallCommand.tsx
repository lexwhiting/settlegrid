'use client'

import { useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'

interface CopyInstallCommandProps {
  /** Template slug, e.g. "airbyte" — used to construct the github: target. */
  slug: string
}

/**
 * Renders the one-line `npx @settlegrid/cli add ...` install command for a
 * template, pre-filled with the visitor's PostHog distinct_id as a
 * `SETTLEGRID_POSTHOG_ID=<id>` env-var prefix.
 *
 * The CLI's getDistinctId() honours that env var (see
 * packages/settlegrid-cli/src/telemetry.ts), so when a visitor pastes the
 * command into their shell, both the postinstall hook
 * (`cli_install_started`) and the `add` invocation
 * (`scaffold_success` / `scaffold_failed`) emit telemetry under the same
 * distinct_id as the preceding browser session. That collapses the four
 * funnel events onto a single PostHog Person, which is the load-bearing
 * requirement for measuring gallery_viewed → cli_install_started conversion.
 *
 * If PostHog hasn't initialised (ad-blocker, opt-out, first paint before
 * provider mount), we fall back to the plain command without the prefix —
 * the install still works, telemetry just won't correlate to the browser id.
 */
export function CopyInstallCommand({ slug }: CopyInstallCommandProps) {
  const posthog = usePostHog()
  const [distinctId, setDistinctId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Resolve the id on mount and again whenever PostHog flips from
    // un-initialised to initialised (the provider's useEffect mounts after
    // ours on first paint, so a single read here would always see null).
    if (!posthog) return
    const id = posthog.get_distinct_id?.()
    if (typeof id === 'string' && id.length > 0) setDistinctId(id)
  }, [posthog])

  const target = `gh:settlegrid/settlegrid-${slug}`
  const command = distinctId
    ? `SETTLEGRID_POSTHOG_ID=${distinctId} npx @settlegrid/cli add --github ${target}`
    : `npx @settlegrid/cli add --github ${target}`

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked by permissions or non-secure context.
      // Fall through silently — the command is already visible on screen so
      // the visitor can select+copy manually.
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/40">
        <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
          Install with the SettleGrid CLI
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs font-medium text-[#E5A336] hover:text-[#d4922f] transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-4 py-3 text-sm overflow-x-auto">
        <code className="font-mono text-foreground">{command}</code>
      </pre>
    </div>
  )
}
