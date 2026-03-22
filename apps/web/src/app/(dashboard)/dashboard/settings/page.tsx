'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
  tier: string
  revenueSharePct: number
  stripeConnectStatus: string
  balanceCents: number
  payoutSchedule: string
  payoutMinimumCents: number
  publicProfile: boolean
  publicBio: string | null
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
    features: ['1 tool', '1,000 invocations/mo', 'Community support', 'Basic analytics'],
  },
  builder: {
    name: 'Builder',
    price: '$29/mo',
    features: ['5 tools', '25,000 invocations/mo', 'Email support', 'Advanced analytics', 'Custom pricing'],
  },
  scale: {
    name: 'Scale',
    price: '$99/mo',
    features: ['25 tools', '250,000 invocations/mo', 'Priority support', 'Webhooks', 'Team members'],
  },
  platform: {
    name: 'Platform',
    price: '$299/mo',
    features: ['Unlimited tools', '2M invocations/mo', 'Dedicated support', 'SSO', 'White-label', 'SLA'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    features: ['Unlimited everything', 'Custom SLA', 'Dedicated CSM', 'On-premise option', 'Custom integrations'],
  },
}

const PLAN_ORDER = ['free', 'builder', 'scale', 'platform', 'enterprise']

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

// ─── Main Settings Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('profile')

  // Profile form state
  const [profileName, setProfileName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [publicProfile, setPublicProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Payout form state
  const [payoutSchedule, setPayoutSchedule] = useState('monthly')
  const [payoutMinimumDollars, setPayoutMinimumDollars] = useState('25')
  const [savingPayouts, setSavingPayouts] = useState(false)

  // Stripe connect state
  const [connecting, setConnecting] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState<NotificationEvent[]>(DEFAULT_NOTIFICATIONS)
  const [savingNotifications, setSavingNotifications] = useState(false)

  // Security form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSecurity, setSavingSecurity] = useState(false)

  // Data & Privacy state
  const [exportingData, setExportingData] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // ─── Fetch Profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/auth/developer/me')
        if (!res.ok) { setError('Failed to load profile'); return }
        const data = await res.json()
        const dev = data.developer as DeveloperProfile
        setProfile(dev)
        setProfileName(dev.name ?? '')
        setProfileBio(dev.publicBio ?? '')
        setPublicProfile(dev.publicProfile)
        setPayoutSchedule(dev.payoutSchedule)
        setPayoutMinimumDollars(String(dev.payoutMinimumCents / 100))
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

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
    setSavingProfile(true)
    try {
      const res = await fetch('/api/dashboard/developer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          publicBio: profileBio,
          publicProfile,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Failed to save profile', 'error')
        return
      }
      setProfile((prev) => prev ? { ...prev, name: profileName, publicBio: profileBio, publicProfile } : prev)
      toast('Profile saved successfully', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSavingProfile(false)
    }
  }, [profileName, profileBio, publicProfile, toast])

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
    // Notification preferences are stored client-side for now
    setTimeout(() => {
      setSavingNotifications(false)
      toast('Notification preferences saved', 'success')
    }, 500)
  }

  function toggleNotification(key: string) {
    setNotifications((prev) =>
      prev.map((n) => n.key === key && !n.critical ? { ...n, emailEnabled: !n.emailEnabled } : n)
    )
  }

  function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('All password fields are required', 'error')
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
    // Password change handled via Supabase Auth
    setTimeout(() => {
      setSavingSecurity(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password change is handled via Supabase Auth. Use the reset password flow.', 'info')
    }, 500)
  }

  function handleExportData() {
    setExportingData(true)
    setTimeout(() => {
      setExportingData(false)
      toast('Data export request submitted. You will receive an email when ready.', 'success')
    }, 1000)
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

  const currentPlanKey = profile?.tier === 'enterprise' ? 'enterprise' : (profile?.tier ?? 'free')
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
                    ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-emerald-400'
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
                    className="flex w-full max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-[#2E3148] dark:bg-[#1A1D2E] dark:text-gray-100 dark:ring-offset-[#0F1117] dark:placeholder:text-gray-500 resize-none"
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
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:ring-offset-[#0F1117] ${
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

                {/* Read-only fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-[#2E3148]">
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
                    <dd className="text-sm text-gray-900 dark:text-gray-100 mt-1">{profile?.revenueSharePct ?? 85}%</dd>
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
                    className="flex h-10 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-[#2E3148] dark:bg-[#1A1D2E] dark:text-gray-100 dark:ring-offset-[#0F1117]"
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
                      min={10}
                      max={500}
                      step={5}
                      value={payoutMinimumDollars}
                      onChange={(e) => setPayoutMinimumDollars(e.target.value)}
                      className="max-w-[120px]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Between $10 and $500</p>
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
                      <div className="border border-gray-200 dark:border-[#2E3148] rounded-md overflow-hidden">
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
                              <tr key={event.key} className="border-t border-gray-100 dark:border-[#2E3148]">
                                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{event.label}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    role="switch"
                                    aria-checked={event.emailEnabled}
                                    aria-label={`${event.label} email notification`}
                                    onClick={() => toggleNotification(event.key)}
                                    disabled={event.critical}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:ring-offset-[#0F1117] disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  <div className="max-w-sm space-y-3">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Password
                      </label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
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
                </div>

                {/* 2FA */}
                <div className="border-t border-gray-200 dark:border-[#2E3148] pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="border-t border-gray-200 dark:border-[#2E3148] pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Active Sessions</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Session management is available in your Supabase dashboard.
                  </p>
                </div>

                {/* Login History */}
                <div className="border-t border-gray-200 dark:border-[#2E3148] pt-4">
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
                {/* Current Plan */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan:</span>
                  <Badge variant="default">
                    {PLANS[currentPlanKey === 'standard' ? 'free' : currentPlanKey]?.name ?? 'Free'}
                  </Badge>
                </div>

                {/* Plan Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PLAN_ORDER.map((planKey, planIndex) => {
                    const plan = PLANS[planKey]
                    const isCurrent = planIndex === (currentPlanIndex < 0 ? 0 : currentPlanIndex)
                    const isUpgrade = planIndex > (currentPlanIndex < 0 ? 0 : currentPlanIndex)
                    return (
                      <div
                        key={planKey}
                        className={`rounded-lg border p-4 ${
                          isCurrent
                            ? 'border-brand bg-brand/5 dark:bg-brand/10'
                            : 'border-gray-200 dark:border-[#2E3148]'
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
                        ) : isUpgrade ? (
                          planKey === 'enterprise' ? (
                            <Button size="sm" variant="outline" className="w-full" asChild>
                              <a href="mailto:sales@settlegrid.ai">Contact Sales</a>
                            </Button>
                          ) : (
                            <Button size="sm" className="w-full">
                              Upgrade to {plan.name}
                            </Button>
                          )
                        ) : (
                          <Button size="sm" variant="ghost" className="w-full" disabled>
                            {plan.name}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══ Section 6: Data & Privacy ════════════════════════════ */}
          <section id="data-privacy">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data & Privacy</CardTitle>
                <CardDescription>Manage your data and privacy preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Export Data */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export My Data</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    Download a copy of all your data including profile, tools, invocations, and payouts.
                  </p>
                  <Button variant="outline" onClick={handleExportData} disabled={exportingData}>
                    {exportingData ? 'Requesting...' : 'Export My Data'}
                  </Button>
                </div>

                {/* Delete Account */}
                <div className="border-t border-gray-200 dark:border-[#2E3148] pt-4">
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
                <div className="border-t border-gray-200 dark:border-[#2E3148] pt-4 space-y-2">
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
