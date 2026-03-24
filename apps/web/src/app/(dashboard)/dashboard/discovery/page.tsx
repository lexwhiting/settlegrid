'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { useToast } from '@/components/ui/toast'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DeveloperProfile {
  id: string
  name: string | null
  slug: string | null
  publicProfile: boolean
  publicBio: string | null
}

interface ToolEntry {
  id: string
  name: string
  slug: string
  status: string
}

// ─── LocalStorage Keys ──────────────────────────────────────────────────────────

const LS_BADGES_DONE = 'settlegrid_discovery_badges_done'
const LS_MCP_DONE = 'settlegrid_discovery_mcp_done'
const LS_SHARE_DONE = 'settlegrid_discovery_share_done'

// ─── Copy Button ────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (insecure context, permissions denied, etc.)
      // Silently fail — the button simply won't show the checkmark
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-gray-400 hover:text-brand transition-colors"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  )
}

// ─── Copyable Code Block ────────────────────────────────────────────────────────

function CopyableCode({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 truncate block max-w-full overflow-x-auto">
        {code}
      </code>
      <CopyButton text={code} label={label} />
    </div>
  )
}

// ─── Section 1: Profile Setup ───────────────────────────────────────────────────

function ProfileSetupSection({
  profile,
  onSaved,
}: {
  profile: DeveloperProfile
  onSaved: (p: DeveloperProfile) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(profile.name ?? '')
  const [slug, setSlug] = useState(profile.slug ?? '')
  const [bio, setBio] = useState(profile.publicBio ?? '')
  const [isPublic, setIsPublic] = useState(profile.publicProfile)
  const [slugError, setSlugError] = useState('')
  const [saving, setSaving] = useState(false)

  const profileUrl = slug ? `settlegrid.ai/dev/${slug}` : null
  const isLive = isPublic && !!slug

  const saveProfile = useCallback(async () => {
    setSlugError('')

    if (slug) {
      if (slug.length < 3 || slug.length > 30) {
        setSlugError('Must be 3-30 characters.')
        return
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
        setSlugError('Only lowercase letters, numbers, and hyphens. No leading/trailing hyphens.')
        return
      }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name,
        publicBio: bio,
        publicProfile: isPublic,
      }
      if (slug) {
        payload.slug = slug.toLowerCase()
      }

      const res = await fetch('/api/dashboard/developer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setSlugError(data.error || 'This profile URL is already taken.')
          return
        }
        toast(data.error || 'Failed to save profile', 'error')
        return
      }
      const updated: DeveloperProfile = {
        ...profile,
        name,
        slug: slug || null,
        publicBio: bio,
        publicProfile: isPublic,
      }
      onSaved(updated)
      toast('Profile saved successfully', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }, [name, slug, bio, isPublic, profile, onSaved, toast])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <CardTitle className="text-lg">Profile Setup</CardTitle>
          </div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Profile is live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Profile not public yet
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Display Name */}
        <div>
          <label htmlFor="disc-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display name
          </label>
          <Input
            id="disc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
            className="max-w-sm border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E]"
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="disc-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Profile slug
          </label>
          <Input
            id="disc-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              setSlugError('')
            }}
            placeholder="my-slug"
            className="max-w-sm border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E]"
          />
          {slugError && (
            <p className="text-xs text-red-500 mt-1">{slugError}</p>
          )}
          {profileUrl && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your profile URL:{' '}
              <span className="font-mono text-brand">{profileUrl}</span>
            </p>
          )}
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="disc-bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio
          </label>
          <textarea
            id="disc-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell consumers and AI agents what you build..."
            className="w-full max-w-lg rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        {/* Public Toggle */}
        <div className="flex items-center gap-3">
          <label htmlFor="disc-public" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Public profile
          </label>
          <button
            id="disc-public"
            role="switch"
            aria-checked={isPublic}
            aria-label={isPublic ? 'Disable public profile' : 'Enable public profile'}
            onClick={() => setIsPublic(!isPublic)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              isPublic ? 'bg-brand' : 'bg-gray-300 dark:bg-[#2E3148]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
          {isLive && slug && (
            <a
              href={`/dev/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand/80 font-medium transition-colors"
            >
              Preview Profile
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section 2: Showcase Status ─────────────────────────────────────────────────

function ShowcaseStatusSection({ tools, onStatusChanged }: { tools: ToolEntry[]; onStatusChanged: () => void }) {
  const { toast } = useToast()
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const activeCount = tools.filter((t) => t.status === 'active').length

  async function activateTool(id: string) {
    setActivatingId(id)
    try {
      const res = await fetch(`/api/tools/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Failed to activate tool', 'error')
        return
      }
      toast('Tool activated', 'success')
      onStatusChanged()
    } catch {
      toast('Network error', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0a2.994 2.994 0 00.612-1.099L4.907 4.5H19.09l1.296 3.75A2.994 2.994 0 0021 9.349" />
            </svg>
            <CardTitle className="text-lg">Showcase Status</CardTitle>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {activeCount} of {tools.length} tool{tools.length !== 1 ? 's' : ''} visible in Showcase
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tools.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tools yet. Create your first tool from the{' '}
            <Link href="/dashboard/tools" className="text-brand hover:text-brand/80 font-medium transition-colors">
              Tools page
            </Link>.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#252836]">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {tool.name}
                    </p>
                    {tool.status === 'active' ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                        Visible in Showcase
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Not visible
                      </Badge>
                    )}
                  </div>
                  {tool.slug && (
                    <a
                      href={`/tools/${tool.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand hover:text-brand/80 transition-colors inline-flex items-center gap-1 mt-0.5"
                    >
                      settlegrid.ai/tools/{tool.slug}
                      <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  )}
                </div>
                {tool.status !== 'active' && tool.status !== 'deleted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activateTool(tool.id)}
                    disabled={activatingId === tool.id}
                  >
                    {activatingId === tool.id ? 'Activating...' : 'Activate'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section 3: Badge Generator ─────────────────────────────────────────────────

function BadgeGeneratorSection({ slug, tools }: { slug: string | null; tools: ToolEntry[] }) {
  const activeTools = tools.filter((t) => t.status === 'active')
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>(activeTools[0]?.slug ?? '')

  // Update selected tool when tools list changes
  useEffect(() => {
    if (!selectedToolSlug && activeTools.length > 0) {
      setSelectedToolSlug(activeTools[0].slug)
    }
  }, [activeTools, selectedToolSlug])

  const poweredByMarkdown = '[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)'
  const toolBadgeMarkdown = selectedToolSlug
    ? `[![SettleGrid](https://settlegrid.ai/api/badge/tool/${selectedToolSlug})](https://settlegrid.ai/tools/${selectedToolSlug})`
    : null
  const devBadgeMarkdown = slug
    ? `[![SettleGrid](https://settlegrid.ai/api/badge/dev/${slug})](https://settlegrid.ai/dev/${slug})`
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <CardTitle className="text-lg">Badge Generator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {/* Powered by SettleGrid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Powered by SettleGrid
          </h3>
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://settlegrid.ai/api/badge/powered-by"
              alt="Powered by SettleGrid badge preview"
              className="h-6"
            />
          </div>
          <CopyableCode code={poweredByMarkdown} label="Powered by SettleGrid badge" />
        </div>

        {/* Tool Badge */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Tool Badge
          </h3>
          {activeTools.length > 0 ? (
            <>
              {activeTools.length > 1 && (
                <select
                  value={selectedToolSlug}
                  onChange={(e) => setSelectedToolSlug(e.target.value)}
                  className="mb-2 text-sm rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  aria-label="Select tool for badge"
                >
                  {activeTools.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedToolSlug && (
                <div className="mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://settlegrid.ai/api/badge/tool/${selectedToolSlug}`}
                    alt={`Tool badge preview for ${selectedToolSlug}`}
                    className="h-6"
                  />
                </div>
              )}
              {toolBadgeMarkdown && (
                <CopyableCode code={toolBadgeMarkdown} label="tool badge" />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Activate a tool to generate a tool badge.
            </p>
          )}
        </div>

        {/* Developer Badge */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Developer Badge
          </h3>
          {slug ? (
            <>
              <div className="mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://settlegrid.ai/api/badge/dev/${slug}`}
                  alt={`Developer badge preview for ${slug}`}
                  className="h-6"
                />
              </div>
              {devBadgeMarkdown && (
                <CopyableCode code={devBadgeMarkdown} label="developer badge" />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set a profile slug above to generate a developer badge.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section 4: CLI Tools ───────────────────────────────────────────────────────

function CLIToolsSection() {
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'settlegrid-discovery': {
          command: 'npx',
          args: ['@settlegrid/discovery'],
        },
      },
    },
    null,
    2
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <CardTitle className="text-lg">CLI Tools</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {/* Scaffold */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Scaffold a new tool
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Generate a complete MCP server project with SettleGrid billing pre-wired. Choose from 4 templates and 3 deploy targets.
          </p>
          <CopyableCode code="npx create-settlegrid-tool" label="scaffold command" />
        </div>

        {/* MCP Discovery Server */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            MCP Discovery Server
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Let AI agents discover your tools natively via MCP. Add this to any MCP client (Claude, Cursor, etc.) to make your tools findable.
          </p>
          <CopyableCode code="npx @settlegrid/discovery" label="discovery server command" />
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Claude Desktop config:
            </p>
            <div className="relative">
              <pre className="text-xs bg-gray-100 dark:bg-[#252836] px-3 py-2.5 rounded font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                {claudeConfig}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={claudeConfig} label="Claude Desktop config" />
              </div>
            </div>
          </div>
        </div>

        {/* SDK Install */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            SDK Install
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            The core SDK. Wrap any function with <code className="bg-gray-100 dark:bg-[#252836] px-1 py-0.5 rounded text-xs">sg.wrap()</code> to enable per-call billing.
          </p>
          <CopyableCode code="npm install @settlegrid/mcp" label="SDK install command" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section 5: LLM Discoverability Checklist ───────────────────────────────────

function DiscoverabilityChecklist({
  profile,
  tools,
}: {
  profile: DeveloperProfile
  tools: ToolEntry[]
}) {
  const [badgesDone, setBadgesDone] = useState(false)
  const [mcpDone, setMcpDone] = useState(false)
  const [shareDone, setShareDone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setBadgesDone(localStorage.getItem(LS_BADGES_DONE) === 'true')
      setMcpDone(localStorage.getItem(LS_MCP_DONE) === 'true')
      setShareDone(localStorage.getItem(LS_SHARE_DONE) === 'true')
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  }, [])

  function toggleManual(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // localStorage unavailable — toggle in-memory only
    }
    setter(next)
  }

  const hasPublicProfile = profile.publicProfile
  const hasSlug = !!profile.slug
  const hasActiveTool = tools.some((t) => t.status === 'active')

  const steps = [
    { label: 'Enable public profile', done: hasPublicProfile, manual: false },
    { label: 'Set a profile slug', done: hasSlug, manual: false },
    { label: 'Publish at least one active tool', done: hasActiveTool, manual: false },
    { label: 'Add badges to your GitHub README', done: badgesDone, manual: true, lsKey: LS_BADGES_DONE, setter: setBadgesDone },
    { label: 'Install MCP Discovery Server', done: mcpDone, manual: true, lsKey: LS_MCP_DONE, setter: setMcpDone },
    { label: 'Share your profile URL', done: shareDone, manual: true, lsKey: LS_SHARE_DONE, setter: setShareDone },
  ]

  const completedCount = steps.filter((s) => s.done).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <CardTitle className="text-lg">LLM Discoverability Checklist</CardTitle>
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {completedCount} of 6 complete
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2 mt-2">
          <div
            className="h-2 rounded-full bg-brand transition-all"
            style={{ width: `${(completedCount / 6) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Complete all steps to maximize how AI agents and consumers discover your tools.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-gray-100 dark:divide-[#252836]">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {step.manual ? (
                <button
                  onClick={() => toggleManual(step.lsKey!, step.done, step.setter!)}
                  className="shrink-0"
                  aria-label={step.done ? `Mark "${step.label}" as incomplete` : `Mark "${step.label}" as complete`}
                >
                  {step.done ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="shrink-0">
                  {step.done ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </div>
              )}
              <p className={`text-sm ${step.done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section 6: Discovery API ───────────────────────────────────────────────────

function DiscoveryAPISection({ slug, tools }: { slug: string | null; tools: ToolEntry[] }) {
  const activeTools = tools.filter((t) => t.status === 'active')
  const searchUrl = 'https://settlegrid.ai/api/v1/discover?q={toolName}'
  const devUrl = slug ? `https://settlegrid.ai/api/v1/discover/developers/${slug}` : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          <CardTitle className="text-lg">Discovery API</CardTitle>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          These public endpoints let anyone -- AI agents, directories, integrations -- find your tools programmatically.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Search endpoint */}
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Search tools
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 truncate block flex-1">
              GET {searchUrl}
            </code>
            <CopyButton text={searchUrl} label="search endpoint" />
            <a
              href="/api/v1/discover?q=example"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:text-brand/80 font-medium transition-colors whitespace-nowrap"
            >
              Test it
            </a>
          </div>
        </div>

        {/* Per-tool endpoints */}
        {activeTools.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Tool detail{activeTools.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {activeTools.map((tool) => {
                const url = `https://settlegrid.ai/api/v1/discover/${tool.slug}`
                return (
                  <div key={tool.id} className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 truncate block flex-1">
                      GET {url}
                    </code>
                    <CopyButton text={url} label={`${tool.name} endpoint`} />
                    <a
                      href={`/api/v1/discover/${tool.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand hover:text-brand/80 font-medium transition-colors whitespace-nowrap"
                    >
                      Test it
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Developer endpoint */}
        {devUrl && (
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Developer profile
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 truncate block flex-1">
                GET {devUrl}
              </code>
              <CopyButton text={devUrl} label="developer endpoint" />
              <a
                href={`/api/v1/discover/developers/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:text-brand/80 font-medium transition-colors whitespace-nowrap"
              >
                Test it
              </a>
            </div>
          </div>
        )}

        {!devUrl && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Set a profile slug to generate your developer discovery endpoint.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [tools, setTools] = useState<ToolEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, toolsRes] = await Promise.all([
        fetch('/api/auth/developer/me'),
        fetch('/api/tools'),
      ])
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data.developer as DeveloperProfile)
      } else {
        setError('Failed to load profile data')
      }
      if (toolsRes.ok) {
        const data = await toolsRes.json()
        setTools(
          (data.tools ?? []).map((t: { id: string; name: string; slug: string; status: string }) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            status: t.status,
          }))
        )
      }
    } catch {
      setError('Network error loading discovery data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Discovery</h1>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Discovery</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm" role="alert">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]} />

      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Discovery</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Everything you need to make your tools findable by consumers and AI agents.
        </p>
      </div>

      {/* Section 1: Profile Setup */}
      {profile && (
        <ProfileSetupSection
          profile={profile}
          onSaved={(updated) => setProfile(updated)}
        />
      )}

      {/* Section 2: Showcase Status */}
      <ShowcaseStatusSection tools={tools} onStatusChanged={fetchData} />

      {/* Section 3: Badge Generator */}
      <BadgeGeneratorSection slug={profile?.slug ?? null} tools={tools} />

      {/* Section 4: CLI Tools */}
      <CLIToolsSection />

      {/* Section 5: LLM Discoverability Checklist */}
      {profile && (
        <DiscoverabilityChecklist profile={profile} tools={tools} />
      )}

      {/* Section 6: Discovery API */}
      <DiscoveryAPISection slug={profile?.slug ?? null} tools={tools} />
    </div>
  )
}
