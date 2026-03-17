'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface DeveloperProfile {
  id: string
  email: string
  name: string
  stripeConnectStatus: string
  balanceCents: number
  payoutSchedule: string
  payoutMinimumCents: number
  createdAt: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/auth/developer/me')
        if (!res.ok) { setError('Failed to load profile'); return }
        const data = await res.json()
        setProfile(data.data)
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  async function connectStripe() {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to start Stripe Connect'); return }
      window.location.href = data.data.url
    } catch {
      setError('Network error')
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]} />
        <h1 className="text-2xl font-bold text-indigo">Settings</h1>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings' },
      ]} />
      <h1 className="text-2xl font-bold text-indigo">Settings</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your developer account information</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="text-sm text-gray-900">{profile?.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{profile?.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Balance</dt>
              <dd className="text-sm font-semibold text-brand-text">{formatCents(profile?.balanceCents ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Payout Schedule</dt>
              <dd className="text-sm text-gray-900 capitalize">{profile?.payoutSchedule}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Payout Minimum</dt>
              <dd className="text-sm text-gray-900">{formatCents(profile?.payoutMinimumCents ?? 2500)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="text-sm text-gray-900">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Stripe Connect */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            Connect your Stripe account to receive payouts. We handle KYC, tax forms, and fraud prevention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge
              variant={profile?.stripeConnectStatus === 'active' ? 'success' : profile?.stripeConnectStatus === 'pending' ? 'warning' : 'secondary'}
            >
              {profile?.stripeConnectStatus === 'active' ? 'Connected' : profile?.stripeConnectStatus === 'pending' ? 'Pending' : 'Not Connected'}
            </Badge>
            {profile?.stripeConnectStatus !== 'active' && (
              <Button onClick={connectStripe} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Stripe'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
