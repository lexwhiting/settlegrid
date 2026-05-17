'use client'

import { useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'

interface CopyInstallCommandProps {
  /** Gallery template slug, e.g. "tmdb". */
  slug: string
}

/**
 * Renders the one-line `npx create-settlegrid-tool --template <slug>` command
 * for a gallery template, pre-filled with the visitor's PostHog distinct_id
 * as a `SETTLEGRID_POSTHOG_ID=<id>` env-var prefix.
 *
 * `create-settlegrid-tool`'s getDistinctId() honours that env var (see
 * packages/create-settlegrid-tool/src/telemetry.ts), so when a visitor pastes
 * the command into their shell, both the postinstall hook
 * (`cli_install_started`) and the scaffold run
 * (`scaffold_success` / `scaffold_failed`) emit telemetry under the same
 * distinct_id as the preceding browser session. That collapses the funnel
 * events onto a single PostHog Person, which is the load-bearing requirement
 * for measuring gallery_viewed → cli_install_started → scaffold conversion.
 *
 * `--template <slug>` downloads the already-monetized gallery repo
 * (github.com/settlegrid/settlegrid-<slug>). This is the correct verb for the
 * gallery flow — unlike `@settlegrid/cli add`, which is a codemod for
 * wrapping an UN-monetized repo and (correctly) reports an already-wrapped
 * gallery template as an unknown repo type.
 *
 * If PostHog hasn't initialised (ad-blocker, opt-out, first paint before
 * provider mount), we fall back to the plain command without the prefix —
 * the scaffold still works, telemetry just won't correlate to the browser id.
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

  const command = distinctId
    ? `SETTLEGRID_POSTHOG_ID=${distinctId} npx create-settlegrid-tool --template ${slug}`
    : `npx create-settlegrid-tool --template ${slug}`

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
          Scaffold this template
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
