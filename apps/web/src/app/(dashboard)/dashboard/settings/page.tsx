'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { useToast } from '@/components/ui/toast'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DeveloperProfile {
  id: string
  email: string
  name: string | null
  slug: string | null
  tier: string
  revenueSharePct: number
  stripeConnectStatus: string
  stripeSubscriptionId: string | null
  balanceCents: number
  payoutSchedule: string
  payoutMinimumCents: number
  publicProfile: boolean
  publicBio: string | null
  logRetentionDays: number
  webhookLogRetentionDays: number
  auditLogRetentionDays: number
  createdAt: string
}

type SectionId = 'profile' | 'payouts' | 'notifications' | 'security' | 'plan' | 'data-privacy'

interface NavItem {
  id: SectionId
  label: string
  icon: React.ReactNode
}

// ─── Notification Types ─────────────────────────────────────────────────────────

interface NotificationEvent {
  key: string
  label: string
  category: 'billing' | 'tools' | 'security' | 'webhooks'
  critical: boolean
  emailEnabled: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationEvent[] = [
  { key: 'payout_completed', label: 'Payout completed', category: 'billing', critical: false, emailEnabled: true },
  { key: 'payout_failed', label: 'Payout failed', category: 'billing', critical: true, emailEnabled: true },
  { key: 'balance_low', label: 'Balance below threshold', category: 'billing', critical: false, emailEnabled: true },
  { key: 'invoice_generated', label: 'Invoice generated', category: 'billing', critical: false, emailEnabled: true },
  { key: 'tool_published', label: 'Tool published', category: 'tools', critical: false, emailEnabled: true },
  { key: 'tool_status_changed', label: 'Tool status changed', category: 'tools', critical: false, emailEnabled: true },
  { key: 'tool_health_down', label: 'Tool health check failed', category: 'tools', critical: true, emailEnabled: true },
  { key: 'usage_spike', label: 'Unusual usage spike detected', category: 'tools', critical: false, emailEnabled: true },
  { key: 'login_new_device', label: 'Login from new device', category: 'security', critical: true, emailEnabled: true },
  { key: 'password_changed', label: 'Password changed', category: 'security', critical: true, emailEnabled: true },
  { key: 'api_key_created', label: 'API key created', category: 'security', critical: false, emailEnabled: true },
  { key: 'suspicious_activity', label: 'Suspicious activity detected', category: 'security', critical: true, emailEnabled: true },
  { key: 'webhook_delivery_failed', label: 'Webhook delivery failed', category: 'webhooks', critical: false, emailEnabled: true },
  { key: 'webhook_endpoint_disabled', label: 'Webhook endpoint disabled', category: 'webhooks', critical: true, emailEnabled: true },
  { key: 'new_review', label: 'New review received', category: 'tools', critical: false, emailEnabled: true },
  { key: 'monthly_summary', label: 'Monthly earnings summary', category: 'billing', critical: false, emailEnabled: true },
  { key: 'onboarding_tips', label: 'Onboarding tips & best practices', category: 'tools', critical: false, emailEnabled: true },
  { key: 'quality_alert', label: 'Tool quality alerts (slow response, errors)', category: 'tools', critical: false, emailEnabled: true },
]

// ─── Plan Data ──────────────────────────────────────────────────────────────────

interface PlanInfo {
  name: string
  price: string
  features: string[]
}

const PLANS: Record<string, PlanInfo> = {
  free: {
    name: 'Free',
    price: '$0/mo',
    features: ['Unlimited tools', '50,000 ops/mo', 'Progressive take rate: 0% on first $1K/mo', 'Free forever — no catch'],
  },
  builder: {
    name: 'Builder',
    price: '$19/mo',
    features: ['Unlimited tools', '200,000 ops/mo', 'Progressive take rate', 'Full analytics & sandbox mode', 'IP allowlisting & CSV export'],
  },
  scale: {
    name: 'Scale',
    price: '$79/mo',
    features: ['Unlimited tools', '2,000,000 ops/mo', 'Progressive take rate', 'Smart Proxy & Transaction Explorer', 'Fraud detection & priority support'],
  },
}

const PLAN_ORDER = ['free', 'builder', 'scale']

/** Map legacy tiers to current tier keys */
function normalizePlanKey(key: string): string {
  if (key === 'starter' || key === 'growth') return 'builder'
  return key
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Icons (inline SVGs) ────────────────────────────────────────────────────────

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function BanknotesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

// ─── Navigation Items ───────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
  { id: 'payouts', label: 'Payouts', icon: <BanknotesIcon className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <BellIcon className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <ShieldIcon className="w-4 h-4" /> },
  { id: 'plan', label: 'Plan & Billing', icon: <CreditCardIcon className="w-4 h-4" /> },
  { id: 'data-privacy', label: 'Data & Privacy', icon: <ArchiveIcon className="w-4 h-4" /> },
]

// ─── Copyable Field ─────────────────────────────────────────────────────────────

function CopyableField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
        {value}
      </code>
      <button
        onClick={handleCopy}
        className="text-gray-400 hover:text-brand transition-colors"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
      </button>
    </div>
  )
}

// ─── Profile Badge Copy Field ──────────────────────────────────────────────────

function ProfileBadgeCopyField({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const badgeMarkdown = `[![SettleGrid](https://settlegrid.ai/api/badge/dev/${slug})](https://settlegrid.ai/dev/${slug})`

  function handleCopy() {
    navigator.clipboard.writeText(badgeMarkdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 max-w-lg truncate block">
        {badgeMarkdown}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 text-gray-400 hover:text-brand transition-colors"
        aria-label="Copy badge markdown"
      >
        {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
      </button>
    </div>
  )
}

// ─── Main Settings Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('profile')

  // Profile form state
  const [profileName, setProfileName] = useState('')
  const [profileSlug, setProfileSlug] = useState('')
  const [profileSlugError, setProfileSlugError] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [publicProfile, setPublicProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Payout form state
  const [payoutSchedule, setPayoutSchedule] = useState('monthly')
  const [payoutMinimumDollars, setPayoutMinimumDollars] = useState('1')
  const [savingPayouts, setSavingPayouts] = useState(false)

  // Stripe connect state
  const [connecting, setConnecting] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState<NotificationEvent[]>(DEFAULT_NOTIFICATIONS)
  const [savingNotifications, setSavingNotifications] = useState(false)

  // Security form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [authProvider, setAuthProvider] = useState<string | null>(null) // 'email' | 'google' | 'github' etc.

  // MFA state
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaDisabling, setMfaDisabling] = useState(false)

  // Data & Privacy state
  const [exportingData, setExportingData] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Data retention state
  const [logRetentionDays, setLogRetentionDays] = useState(90)
  const [webhookLogRetentionDays, setWebhookLogRetentionDays] = useState(30)
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState(365)
  const [savingRetention, setSavingRetention] = useState(false)

  // Marketing communications toggle
  const [marketingUpdates, setMarketingUpdates] = useState(true)

  // Selective export state
  const [exportCategories, setExportCategories] = useState({
    profile: true,
    tools: true,
    invocations: true,
    payouts: true,
    webhooks: true,
    audit_logs: true,
  })
  const [exportDays, setExportDays] = useState(90)

  // Plan & Billing state
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)
  const [managingSubscription, setManagingSubscription] = useState(false)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // ─── Fetch Profile ──────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/developer/me')
      if (!res.ok) { setError('Failed to load profile'); return }
      const data = await res.json()
      const dev = data.developer as DeveloperProfile
      setProfile(dev)
      setProfileName(dev.name ?? '')
      setProfileSlug(dev.slug ?? '')
      setProfileBio(dev.publicBio ?? '')
      setPublicProfile(dev.publicProfile)
      setPayoutSchedule(dev.payoutSchedule)
      setPayoutMinimumDollars(String(dev.payoutMinimumCents / 100))
      setLogRetentionDays(dev.logRetentionDays ?? 90)
      setWebhookLogRetentionDays(dev.webhookLogRetentionDays ?? 30)
      setAuditLogRetentionDays(dev.auditLogRetentionDays ?? 365)

      // Load saved notification preferences
      try {
        const prefsRes = await fetch('/api/dashboard/developer/notification-preferences')
        if (prefsRes.ok) {
          const prefsData = await prefsRes.json()
          const saved = prefsData.preferences as Record<string, boolean>
          if (saved && Object.keys(saved).length > 0) {
            setNotifications((prev) =>
              prev.map((n) => saved[n.key] !== undefined ? { ...n, emailEnabled: saved[n.key] } : n)
            )
            // Load marketing communications preference
            if (saved.marketing_updates !== undefined) {
              setMarketingUpdates(saved.marketing_updates)
            }
          }
        }
      } catch {
        // Non-critical — use defaults
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    // Detect auth provider (email vs OAuth)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const provider = user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? 'email'
        setAuthProvider(provider)
      }
    })
  }, [fetchProfile])

  // ─── Subscription result toast ───────────────────────────────────────────────

  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription')
    if (subscriptionStatus === 'success') {
      toast('Subscription activated! Your plan will update shortly.', 'success')
      // Clean up URL params without page reload
      const url = new URL(window.location.href)
      url.searchParams.delete('subscription')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    } else if (subscriptionStatus === 'cancelled') {
      toast('Subscription checkout was cancelled.', 'info')
      const url = new URL(window.location.href)
      url.searchParams.delete('subscription')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, toast])

  // ─── Scroll spy ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [loading])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const saveProfile = useCallback(async () => {
    setProfileSlugError('')

    // Client-side slug validation
    if (profileSlug) {
      if (profileSlug.length < 3 || profileSlug.length > 30) {
        setProfileSlugError('Must be 3-30 characters.')
        return
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(profileSlug)) {
        setProfileSlugError('Only lowercase letters, numbers, and hyphens. No leading/trailing hyphens.')
        return
      }
    }

    // Require a slug before enabling public profile
    if (publicProfile && !profileSlug && !profile?.slug) {
      toast('Set a profile URL before enabling your public profile.', 'error')
      return
    }

    setSavingProfile(true)
    try {
      const payload: Record<string, unknown> = {
        name: profileName,
        publicBio: profileBio,
        publicProfile,
      }
      if (profileSlug) {
        payload.slug = profileSlug.toLowerCase()
      }

      const res = await fetch('/api/dashboard/developer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setProfileSlugError(data.error || 'This profile URL is already taken.')
          return
        }
        toast(data.error || 'Failed to save profile', 'error')
        return
      }
      setProfile((prev) => prev ? { ...prev, name: profileName, slug: profileSlug || null, publicBio: profileBio, publicProfile } : prev)
      toast('Profile saved successfully', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSavingProfile(false)
    }
  }, [profileName, profileSlug, profileBio, publicProfile, profile?.slug, toast])

  const savePayoutSettings = useCallback(async () => {
    const dollars = parseFloat(payoutMinimumDollars)
    if (isNaN(dollars) || dollars < 10 || dollars > 500) {
      toast('Minimum payout must be between $10 and $500', 'error')
      return
    }
    setSavingPayouts(true)
    try {
      const res = await fetch('/api/dashboard/developer/payout-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutSchedule,
          payoutMinimumCents: Math.round(dollars * 100),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Failed to save payout settings', 'error')
        return
      }
      setProfile((prev) => prev ? {
        ...prev,
        payoutSchedule,
        payoutMinimumCents: Math.round(dollars * 100),
      } : prev)
      toast('Payout settings saved', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSavingPayouts(false)
    }
  }, [payoutSchedule, payoutMinimumDollars, toast])

  async function connectStripe() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Failed to start Stripe Connect', 'error'); return }
      window.location.href = data.url
    } catch {
      toast('Network error', 'error')
    } finally {
      setConnecting(false)
    }
  }

  function saveNotifications() {
    setSavingNotifications(true)
    const prefs: Record<string, boolean> = {}
    for (const n of notifications) {
      prefs[n.key] = n.emailEnabled
    }
    fetch('/api/dashboard/developer/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast(data.error || 'Failed to save notification preferences', 'error')
        } else {
          toast('Notification preferences saved', 'success')
        }
      })
      .catch(() => toast('Network error', 'error'))
      .finally(() => setSavingNotifications(false))
  }

  function toggleNotification(key: string) {
    setNotifications((prev) =>
      prev.map((n) => n.key === key && !n.critical ? { ...n, emailEnabled: !n.emailEnabled } : n)
    )
  }

  // ─── MFA: Fetch status on mount ─────────────────────────────────────────────

  useEffect(() => {
    async function fetchMfaStatus() {
      try {
        const res = await fetch('/api/auth/mfa')
        if (res.ok) {
          const data = await res.json()
          setMfaEnrolled(data.enrolled)
          if (data.factors?.length > 0) {
            setMfaFactorId(data.factors[0].id)
          }
        }
      } catch {
        // Non-critical — MFA status defaults to not enrolled
      } finally {
        setMfaLoading(false)
      }
    }
    fetchMfaStatus()
  }, [])

  async function handleEnableMfa() {
    setMfaEnrolling(true)
    try {
      const res = await fetch('/api/auth/mfa', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to start MFA enrollment', 'error')
        return
      }
      setMfaFactorId(data.factorId)
      setMfaQrCode(data.qrCode)
      setMfaSecret(data.secret)
    } catch {
      toast('Network error', 'error')
    } finally {
      setMfaEnrolling(false)
    }
  }

  async function handleVerifyMfa() {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      toast('Please enter a valid 6-digit code', 'error')
      return
    }
    setMfaVerifying(true)
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: mfaFactorId, code: mfaCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Invalid verification code', 'error')
        return
      }
      setMfaEnrolled(true)
      setMfaQrCode('')
      setMfaSecret('')
      setMfaCode('')
      toast('Two-factor authentication enabled successfully', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setMfaVerifying(false)
    }
  }

  async function handleDisableMfa() {
    if (!mfaFactorId) {
      toast('No MFA factor found to disable', 'error')
      return
    }
    setMfaDisabling(true)
    try {
      const res = await fetch(`/api/auth/mfa?factorId=${encodeURIComponent(mfaFactorId)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to disable MFA', 'error')
        return
      }
      setMfaEnrolled(false)
      setMfaFactorId('')
      toast('Two-factor authentication disabled', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setMfaDisabling(false)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast('Please enter and confirm your new password', 'error')
      return
    }
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error')
      return
    }
    setSavingSecurity(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast(error.message || 'Failed to update password', 'error')
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated successfully', 'success')
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSavingSecurity(false)
    }
  }

  async function handleExportData() {
    const selectedCategories = Object.entries(exportCategories)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (selectedCategories.length === 0) {
      toast('Select at least one data category to export', 'error')
      return
    }
    setExportingData(true)
    try {
      const res = await fetch('/api/dashboard/developer/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selectedCategories, days: exportDays }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to export data', 'error')
        return
      }
      toast('Export ready! Check your email for the download link.', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setExportingData(false)
    }
  }

  async function saveRetentionSettings() {
    setSavingRetention(true)
    try {
      const res = await fetch('/api/dashboard/developer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logRetentionDays,
          webhookLogRetentionDays,
          auditLogRetentionDays,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Failed to save retention settings', 'error')
        return
      }
      toast('Retention settings saved', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSavingRetention(false)
    }
  }

  function toggleMarketingUpdates() {
    const newValue = !marketingUpdates
    setMarketingUpdates(newValue)
    // Save to notification preferences API
    fetch('/api/dashboard/developer/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketing_updates: newValue }),
    })
      .then(async (res) => {
        if (!res.ok) toast('Failed to update preference', 'error')
        else toast(newValue ? 'Marketing emails enabled' : 'Marketing emails disabled', 'success')
      })
      .catch(() => toast('Network error', 'error'))
  }

  function toggleExportCategory(key: keyof typeof exportCategories) {
    setExportCategories((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleUpgradePlan(plan: string) {
    setUpgradingPlan(plan)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to start upgrade', 'error')
        return
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch {
      toast('Network error', 'error')
    } finally {
      setUpgradingPlan(null)
    }
  }

  async function handleManageSubscription() {
    setManagingSubscription(true)
    try {
      const res = await fetch('/api/billing/manage', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to open billing portal', 'error')
        return
      }
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      }
    } catch {
      toast('Network error', 'error')
    } finally {
      setManagingSubscription(false)
    }
  }

  async function handleChangePlan(plan: string) {
    setChangingPlan(plan)
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to change plan', 'error')
        return
      }
      toast(data.message || `Switched to ${plan} plan`, 'success')
      // Refresh profile to reflect the new tier
      fetchProfile()
    } catch {
      toast('Network error', 'error')
    } finally {
      setChangingPlan(null)
    }
  }

  function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      toast('Type DELETE to confirm account deletion', 'error')
      return
    }
    toast('Account deletion request submitted. Contact support@settlegrid.ai to finalize.', 'info')
    setShowDeleteConfirm(false)
    setDeleteConfirmText('')
  }

  function scrollToSection(id: SectionId) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Settings</h1>
        <div className="flex gap-8">
          <div className="w-56 shrink-0 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
          <div className="flex-1 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-48 mb-4" />
                  <Skeleton className="h-4 w-72" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Derived Values ─────────────────────────────────────────────────────────

  const rawTier = profile?.tier ?? 'free'
  const currentPlanKey = rawTier === 'enterprise' ? 'enterprise' : normalizePlanKey(rawTier)
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanKey === 'standard' ? 'free' : currentPlanKey)
  const notificationCategories = ['billing', 'tools', 'security', 'webhooks'] as const

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings' },
      ]} />
      <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Settings</h1>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      <div className="flex gap-8">
        {/* ─── Sidebar Navigation ─────────────────────────────────── */}
        <nav className="w-56 shrink-0 hidden md:block" aria-label="Settings sections">
          <div className="sticky top-24 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                  activeSection === item.id
                    ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-amber-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#252836]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ─── Content Area ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-10">

          {/* ═══ Section 1: Profile ═══════════════════════════════════ */}
          <section id="profile">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your developer account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Display Name */}
                <div>
                  <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name
                  </label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                    className="max-w-sm"
                  />
                </div>

                {/* Profile URL */}
                <div>
                  <label htmlFor="profile-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Profile URL
                  </label>
                  <div className="flex items-center gap-0 max-w-lg">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-[#2A2D3E] dark:bg-[#252836] dark:text-gray-400 whitespace-nowrap">
                      settlegrid.ai/developers/
                    </span>
                    <Input
                      id="profile-slug"
                      value={profileSlug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                        setProfileSlug(val)
                        setProfileSlugError('')
                      }}
                      placeholder="e.g., your-name"
                      maxLength={30}
                      className="rounded-l-none"
                    />
                  </div>
                  {profileSlugError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{profileSlugError}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Choose a unique URL for your public profile. Only lowercase letters, numbers, and hyphens.
                  </p>
                  {profileSlug && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(profileSlug) && profileSlug.length >= 3 && (
                    <p className="mt-1 text-xs text-brand dark:text-amber-400">
                      Your profile: settlegrid.ai/developers/{profileSlug}
                    </p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{profile?.email}</p>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value.slice(0, 500))}
                    placeholder="Tell others about yourself and your tools..."
                    maxLength={500}
                    rows={3}
                    className="flex w-full max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-[#2A2D3E] dark:bg-[#161822] dark:text-gray-100 dark:ring-offset-[#0C0E14] dark:placeholder:text-gray-500 resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{profileBio.length}/500 characters</p>
                </div>

                {/* Public Profile Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    role="switch"
                    aria-checked={publicProfile}
                    aria-label="Public profile"
                    onClick={() => setPublicProfile(!publicProfile)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:ring-offset-[#0C0E14] ${
                      publicProfile ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        publicProfile ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Public profile</span>
                </div>

                {/* Public Profile Preview & Badge */}
                {publicProfile && profileSlug && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(profileSlug) && profileSlug.length >= 3 && (
                  <div className="rounded-lg border border-brand/20 bg-brand/5 dark:bg-brand/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Your public profile is visible at{' '}
                        <span className="font-medium text-brand dark:text-amber-400">settlegrid.ai/dev/{profileSlug}</span>.
                        Consumers and AI agents can discover you and your tools here.
                      </p>
                      <Link
                        href={`/dev/${profileSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 ml-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
                      >
                        Preview your public profile
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </Link>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Badge embed (Markdown)
                      </label>
                      <ProfileBadgeCopyField slug={profileSlug} />
                    </div>
                  </div>
                )}

                {/* Read-only fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-[#2A2D3E]">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Developer ID</dt>
                    <dd className="mt-1">
                      <CopyableField value={profile?.id ?? ''} label="Developer ID" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Tier</dt>
                    <dd className="mt-1">
                      <Badge variant={currentPlanKey === 'enterprise' ? 'default' : 'secondary'}>
                        {currentPlanKey === 'standard' ? 'Free' : currentPlanKey.charAt(0).toUpperCase() + currentPlanKey.slice(1)}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue Share</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      Progressive
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        (0% on first $1K/mo, 2% on $1K-$10K, 3% on $10K-$50K, 5% above $50K)
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      {profile?.createdAt ? formatDate(profile.createdAt) : '--'}
                    </dd>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 2: Payouts ═══════════════════════════════════ */}
          <section id="payouts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payouts</CardTitle>
                <CardDescription>Manage your Stripe Connect and payout preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Stripe Connect Status */}
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stripe Connect
                    </label>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={profile?.stripeConnectStatus === 'active' ? 'success' : profile?.stripeConnectStatus === 'pending' ? 'warning' : 'secondary'}
                      >
                        {profile?.stripeConnectStatus === 'active' ? 'Connected' : profile?.stripeConnectStatus === 'pending' ? 'Pending' : 'Not Connected'}
                      </Badge>
                      {profile?.stripeConnectStatus !== 'active' && (
                        <Button size="sm" onClick={connectStripe} disabled={connecting}>
                          {connecting ? 'Connecting...' : profile?.stripeConnectStatus === 'pending' ? 'Reconnect' : 'Connect Stripe'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payout Schedule */}
                <div>
                  <label htmlFor="payout-schedule" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payout Schedule
                  </label>
                  <select
                    id="payout-schedule"
                    value={payoutSchedule}
                    onChange={(e) => setPayoutSchedule(e.target.value)}
                    className="flex h-10 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-[#2A2D3E] dark:bg-[#161822] dark:text-gray-100 dark:ring-offset-[#0C0E14]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Minimum Payout Amount */}
                <div>
                  <label htmlFor="payout-minimum" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Payout Amount
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <span className="text-sm text-gray-500 dark:text-gray-400">$</span>
                    <Input
                      id="payout-minimum"
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={payoutMinimumDollars}
                      onChange={(e) => setPayoutMinimumDollars(e.target.value)}
                      className="max-w-[120px]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">As low as $1 — get paid faster</p>
                </div>

                {/* Current Balance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Balance
                  </label>
                  <p className="text-lg font-semibold text-brand-text">
                    {formatCents(profile?.balanceCents ?? 0)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/dashboard/payouts"
                    className="text-sm text-brand hover:text-brand-dark font-medium transition-colors"
                  >
                    View Payout History &rarr;
                  </Link>
                  <Button onClick={savePayoutSettings} disabled={savingPayouts}>
                    {savingPayouts ? 'Saving...' : 'Save Payout Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 3: Notifications ═════════════════════════════ */}
          <section id="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>Choose which events trigger email notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {notificationCategories.map((category) => {
                  const events = notifications.filter((n) => n.category === category)
                  return (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 capitalize">{category}</h4>
                      <div className="border border-gray-200 dark:border-[#2A2D3E] rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-[#252836]">
                              <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Event</th>
                              <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-20">Email</th>
                              <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-20">Critical</th>
                            </tr>
                          </thead>
                          <tbody>
                            {events.map((event) => (
                              <tr key={event.key} className="border-t border-gray-100 dark:border-[#2A2D3E]">
                                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{event.label}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    role="switch"
                                    aria-checked={event.emailEnabled}
                                    aria-label={`${event.label} email notification`}
                                    onClick={() => toggleNotification(event.key)}
                                    disabled={event.critical}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:ring-offset-[#0C0E14] disabled:cursor-not-allowed disabled:opacity-60 ${
                                      event.emailEnabled ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        event.emailEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {event.critical && (
                                    <LockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                <div className="flex justify-end pt-2">
                  <Button onClick={saveNotifications} disabled={savingNotifications}>
                    {savingNotifications ? 'Saving...' : 'Save Notification Preferences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 4: Security ══════════════════════════════════ */}
          <section id="security">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Manage your password and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Change Password */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change Password</h4>
                  {authProvider && authProvider !== 'email' ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      You signed in with <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{authProvider}</span>. Password management is handled by your OAuth provider.
                    </p>
                  ) : (
                    <div className="max-w-sm space-y-3">
                      <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          New Password
                        </label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          placeholder="At least 8 characters"
                        />
                      </div>
                      <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Confirm New Password
                        </label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <Button onClick={handleChangePassword} disabled={savingSecurity} variant="outline">
                        {savingSecurity ? 'Updating...' : 'Update Password'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2FA */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {mfaLoading ? (
                        <Skeleton className="h-6 w-20 rounded-full" />
                      ) : mfaEnrolled ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">Enabled</Badge>
                      ) : null}
                    </div>
                  </div>

                  {!mfaLoading && !mfaEnrolled && !mfaQrCode && (
                    <Button onClick={handleEnableMfa} disabled={mfaEnrolling} variant="outline" size="sm">
                      {mfaEnrolling ? 'Starting...' : 'Enable 2FA'}
                    </Button>
                  )}

                  {mfaQrCode && !mfaEnrolled && (
                    <div className="space-y-4 p-4 border border-gray-200 dark:border-[#2A2D3E] rounded-lg bg-gray-50 dark:bg-[#1A1F3A]/50">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy):
                      </p>
                      <div className="flex justify-center">
                        {/* QR code rendered as a URI the user can scan. We use an img tag with a QR API. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaQrCode)}`}
                          alt="TOTP QR Code"
                          width={200}
                          height={200}
                          className="rounded-md"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Or enter this secret manually:</p>
                        <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 block break-all">
                          {mfaSecret}
                        </code>
                      </div>
                      <div className="max-w-xs space-y-2">
                        <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enter 6-digit code
                        </label>
                        <Input
                          id="mfa-code"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          autoComplete="one-time-code"
                        />
                        <Button onClick={handleVerifyMfa} disabled={mfaVerifying || mfaCode.length !== 6} size="sm">
                          {mfaVerifying ? 'Verifying...' : 'Verify & Activate'}
                        </Button>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Save your secret key in a secure location. You will need it if you lose access to your authenticator app.
                      </p>
                    </div>
                  )}

                  {!mfaLoading && mfaEnrolled && (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">Two-factor authentication is active.</p>
                      <Button onClick={handleDisableMfa} disabled={mfaDisabling} variant="destructive" size="sm">
                        {mfaDisabling ? 'Disabling...' : 'Disable 2FA'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Active Sessions */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Active Sessions</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Session management is available in your Supabase dashboard.
                  </p>
                </div>

                {/* Login History */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <Link
                    href="/dashboard/audit-log"
                    className="text-sm text-brand hover:text-brand-dark font-medium transition-colors"
                  >
                    View Login History &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 5: Plan & Billing ════════════════════════════ */}
          <section id="plan">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Plan & Billing</CardTitle>
                <CardDescription>Manage your subscription and billing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Current Plan Summary */}
                {(() => {
                  const planKey = currentPlanKey === 'standard' ? 'free' : normalizePlanKey(currentPlanKey)
                  const plan = PLANS[planKey]
                  const opsLimit = planKey === 'free' ? '50,000' : planKey === 'builder' ? '200,000' : '2,000,000'
                  const takeRate = 'Progressive'
                  const revenueShare = 'Up to 100%'
                  return (
                    <div className="rounded-lg border border-brand/30 bg-brand/5 dark:bg-brand/10 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan:</span>
                        <Badge variant="default">{plan?.name ?? 'Free'}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{revenueShare}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Revenue Share</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{opsLimit}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ops/month</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{takeRate}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Platform Fee</p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Plan Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PLAN_ORDER.map((planKey, planIndex) => {
                    const plan = PLANS[planKey]
                    const effectiveCurrentIndex = currentPlanIndex < 0 ? 0 : currentPlanIndex
                    const isCurrent = planIndex === effectiveCurrentIndex
                    const isUpgrade = planIndex > effectiveCurrentIndex
                    const isDowngrade = planIndex < effectiveCurrentIndex && planKey !== 'free'
                    const isPaidPlan = planKey !== 'free'
                    return (
                      <div
                        key={planKey}
                        className={`rounded-lg border p-4 ${
                          isCurrent
                            ? 'border-brand bg-brand/5 dark:bg-brand/10'
                            : 'border-gray-200 dark:border-[#2A2D3E]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h4>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{plan.price}</span>
                        </div>
                        <ul className="space-y-1.5 mb-4">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <CheckIcon className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isCurrent ? (
                          <Badge variant="outline" className="w-full justify-center">Current Plan</Badge>
                        ) : isUpgrade && isPaidPlan ? (
                          profile?.stripeSubscriptionId ? (
                            /* Has subscription — use change-plan API for instant upgrade */
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleChangePlan(planKey)}
                              disabled={changingPlan === planKey}
                            >
                              {changingPlan === planKey ? 'Switching...' : `Upgrade to ${plan.name}`}
                            </Button>
                          ) : (
                            /* No subscription — create new checkout session */
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleUpgradePlan(planKey)}
                              disabled={upgradingPlan === planKey}
                            >
                              {upgradingPlan === planKey ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                            </Button>
                          )
                        ) : isDowngrade && profile?.stripeSubscriptionId ? (
                          /* Has subscription — use change-plan API for downgrade */
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleChangePlan(planKey)}
                            disabled={changingPlan === planKey}
                          >
                            {changingPlan === planKey ? 'Switching...' : `Downgrade to ${plan.name}`}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="w-full" disabled>
                            {plan.name}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Proration info */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-2">
                  <p>Changes are prorated — you only pay the difference for upgrades.</p>
                  <p>Downgrades apply a prorated credit to your next invoice.</p>
                </div>

                {/* Cancel / Manage Billing — uses Stripe Billing Portal (cancel + payment methods) */}
                {profile?.stripeSubscriptionId && (
                  <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4 flex items-center gap-4">
                    <Button onClick={handleManageSubscription} disabled={managingSubscription} variant="outline" size="sm">
                      {managingSubscription ? 'Opening...' : 'Cancel or Update Payment Method'}
                    </Button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Cancel anytime — your tools keep working until the period ends
                    </span>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                  Need higher limits or a custom arrangement?{' '}
                  <a href="mailto:support@settlegrid.ai" className="text-brand hover:text-brand-dark font-medium">
                    Let&apos;s talk
                  </a>
                </p>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 6: Data & Privacy ════════════════════════════ */}
          <section id="data-privacy">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data & Privacy</CardTitle>
                <CardDescription>Manage your data retention, privacy preferences, and exports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* A. Data Retention Settings */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Retention</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    Configure how long different types of data are retained.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="log-retention" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Invocation Log Retention
                      </label>
                      <select
                        id="log-retention"
                        value={logRetentionDays}
                        onChange={(e) => setLogRetentionDays(Number(e.target.value))}
                        className="w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1F3A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days (default)</option>
                        <option value={180}>180 days</option>
                        <option value={365}>365 days</option>
                        <option value={0}>Forever</option>
                      </select>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">How long to keep invocation records</p>
                    </div>
                    <div>
                      <label htmlFor="webhook-retention" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Webhook Log Retention
                      </label>
                      <select
                        id="webhook-retention"
                        value={webhookLogRetentionDays}
                        onChange={(e) => setWebhookLogRetentionDays(Number(e.target.value))}
                        className="w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1F3A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days (default)</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                      </select>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">How long to keep webhook delivery logs</p>
                    </div>
                    <div>
                      <label htmlFor="audit-retention" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Audit Log Retention
                      </label>
                      <select
                        id="audit-retention"
                        value={auditLogRetentionDays}
                        onChange={(e) => setAuditLogRetentionDays(Number(e.target.value))}
                        className="w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1F3A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value={90}>90 days (minimum)</option>
                        <option value={180}>180 days</option>
                        <option value={365}>365 days (default)</option>
                        <option value={730}>730 days</option>
                      </select>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">How long to keep audit trail records</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button variant="outline" onClick={saveRetentionSettings} disabled={savingRetention}>
                      {savingRetention ? 'Saving...' : 'Save Retention Settings'}
                    </Button>
                  </div>
                </div>

                {/* B. Third-Party Data Transparency */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Third-Party Services</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    Services that process your data as part of SettleGrid&apos;s operation.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Service</th>
                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Data Shared</th>
                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Purpose</th>
                          <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Policy</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600 dark:text-gray-300">
                        <tr className="border-b border-gray-100 dark:border-[#252836]">
                          <td className="py-2 pr-4 font-medium">Stripe</td>
                          <td className="py-2 pr-4">Payment data, email, payout details</td>
                          <td className="py-2 pr-4">Payment processing &amp; developer payouts</td>
                          <td className="py-2"><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">stripe.com/privacy</a></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-[#252836]">
                          <td className="py-2 pr-4 font-medium">Supabase</td>
                          <td className="py-2 pr-4">All account data (database host)</td>
                          <td className="py-2 pr-4">Authentication &amp; data storage</td>
                          <td className="py-2"><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">supabase.com/privacy</a></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-[#252836]">
                          <td className="py-2 pr-4 font-medium">Resend</td>
                          <td className="py-2 pr-4">Email address</td>
                          <td className="py-2 pr-4">Transactional email delivery</td>
                          <td className="py-2"><a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">resend.com/legal/privacy-policy</a></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-[#252836]">
                          <td className="py-2 pr-4 font-medium">Upstash Redis</td>
                          <td className="py-2 pr-4">API key hashes, rate limit counters</td>
                          <td className="py-2 pr-4">Rate limiting &amp; real-time metering</td>
                          <td className="py-2"><a href="https://upstash.com/trust/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">upstash.com/trust/privacy-policy</a></td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 font-medium">Vercel</td>
                          <td className="py-2 pr-4">Server logs, IP addresses</td>
                          <td className="py-2 pr-4">Application hosting</td>
                          <td className="py-2"><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">vercel.com/legal/privacy-policy</a></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* C. Marketing Communications Toggle */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Product updates and tips</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Receive occasional emails about new features, tips, and SettleGrid news.
                        Transactional emails (payouts, security alerts) are always sent.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={marketingUpdates}
                      aria-label="Toggle marketing emails"
                      onClick={toggleMarketingUpdates}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                        marketingUpdates ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out ${
                          marketingUpdates ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* D. Selective Data Export */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export My Data</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    Select which data categories to include in your export.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 mb-3">
                    {([
                      ['profile', 'Profile & Account'],
                      ['tools', 'Tools & Configuration'],
                      ['invocations', 'Invocations'],
                      ['payouts', 'Payouts & Revenue'],
                      ['webhooks', 'Webhook Endpoints'],
                      ['audit_logs', 'Audit Logs'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportCategories[key]}
                          onChange={() => toggleExportCategory(key)}
                          className="rounded border-gray-300 dark:border-gray-600 text-brand focus:ring-brand"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <label htmlFor="export-days" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Date range:
                    </label>
                    <select
                      id="export-days"
                      value={exportDays}
                      onChange={(e) => setExportDays(Number(e.target.value))}
                      className="rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1F3A] px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                      <option value={90}>Last 90 days (default)</option>
                      <option value={180}>Last 180 days</option>
                      <option value={365}>Last 365 days</option>
                    </select>
                  </div>
                  <Button variant="outline" onClick={handleExportData} disabled={exportingData}>
                    {exportingData ? 'Exporting...' : 'Export Selected'}
                  </Button>
                </div>

                {/* Delete Account */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Delete Account</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  {!showDeleteConfirm ? (
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                      Delete My Account
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 border border-red-200 dark:border-red-800/40 rounded-md bg-red-50 dark:bg-red-900/10">
                      <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                        Type DELETE to confirm account deletion:
                      </p>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE"
                        className="max-w-xs border-red-300 dark:border-red-700"
                      />
                      <div className="flex gap-2">
                        <Button variant="destructive" onClick={handleDeleteAccount}>
                          Confirm Deletion
                        </Button>
                        <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Privacy Links */}
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4 space-y-2">
                  <Link
                    href="/privacy"
                    className="block text-sm text-brand hover:text-brand-dark font-medium transition-colors"
                  >
                    Privacy Policy &rarr;
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    We retain your data for the duration of your account plus 90 days after deletion for compliance purposes.
                    Payment records are retained for 7 years per regulatory requirements.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </div>
  )
}
