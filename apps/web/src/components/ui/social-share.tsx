'use client'

import { useState } from 'react'

interface SocialShareBaseProps {
  /** Optional className for the container */
  className?: string
}

interface AchievementShareProps extends SocialShareBaseProps {
  type: 'achievement'
  badgeName: string
  badgeIcon: string
  toolName?: never
  toolSlug?: never
}

interface ToolShareProps extends SocialShareBaseProps {
  type: 'tool'
  toolName: string
  toolSlug: string
  badgeName?: never
  badgeIcon?: never
}

type SocialShareProps = AchievementShareProps | ToolShareProps

const BASE_URL = 'https://settlegrid.ai'

function buildShareText(props: SocialShareProps): string {
  if (props.type === 'achievement') {
    return `Just earned the '${props.badgeName}' achievement on SettleGrid! ${BASE_URL}`
  }
  return `I just published ${props.toolName} on @settlegrid — AI agents can now discover and pay for it per call. ${BASE_URL}/tools/${props.toolSlug}`
}

function buildShareUrl(props: SocialShareProps): string {
  if (props.type === 'tool') {
    return `${BASE_URL}/tools/${props.toolSlug}`
  }
  return BASE_URL
}

export function SocialShare(props: SocialShareProps) {
  const [copied, setCopied] = useState(false)

  const shareText = buildShareText(props)
  const shareUrl = buildShareUrl(props)

  // LinkedIn share URL — uses the sharing intent with pre-filled text
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`

  // Twitter/X share URL
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <div className={`flex items-center gap-2 ${props.className ?? ''}`}>
      {/* Share on LinkedIn */}
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium transition-colors"
        aria-label="Share on LinkedIn"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        LinkedIn
      </a>

      {/* Share on Twitter/X */}
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-medium transition-colors"
        aria-label="Share on X (Twitter)"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Post
      </a>

      {/* Copy link */}
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#161822] hover:bg-gray-50 dark:hover:bg-[#252836] text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
        aria-label="Copy share text to clipboard"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.555a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  )
}
