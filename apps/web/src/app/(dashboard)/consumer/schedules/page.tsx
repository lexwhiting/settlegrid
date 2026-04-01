'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

// ── Types ───────────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  toolId: string
  toolName: string
  method: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConsumerSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Create form
  const [formToolId, setFormToolId] = useState('')
  const [formMethod, setFormMethod] = useState('')
  const [formCron, setFormCron] = useState('')
  const [formError, setFormError] = useState('')

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/consumer/schedules')
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules ?? [])
      } else {
        setError('Failed to load schedules.')
      }
    } catch {
      setError('Network error loading schedules.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  async function createSchedule() {
    setFormError('')
    if (!formToolId.trim() || !formMethod.trim() || !formCron.trim()) {
      setFormError('All fields are required.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/consumer/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: formToolId.trim(),
          method: formMethod.trim(),
          cronExpression: formCron.trim(),
        }),
      })
      if (res.ok) {
        setFormToolId('')
        setFormMethod('')
        setFormCron('')
        fetchSchedules()
      } else {
        const data = await res.json().catch(() => ({}))
        setFormError((data as Record<string, string>).error ?? 'Failed to create schedule.')
      }
    } catch {
      setFormError('Network error.')
    } finally {
      setCreating(false)
    }
  }

  async function toggleSchedule(id: string, enabled: boolean) {
    try {
      await fetch('/api/consumer/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id, enabled: !enabled }),
      })
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
      )
    } catch {
      // Silently fail
    }
  }

  async function deleteSchedule(id: string) {
    try {
      const res = await fetch('/api/consumer/schedules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id }),
      })
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id))
      }
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Schedules' }]} />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Schedules' }]} />

      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Scheduled Invocations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Automate tool calls on a cron schedule. Credits are deducted on each run.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">
          {error}
        </div>
      )}

      {/* Create Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Create Schedule</CardTitle>
          <CardDescription>Set up a cron-based automatic invocation for any tool you have credits for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Tool ID</label>
              <Input
                value={formToolId}
                onChange={(e) => setFormToolId(e.target.value)}
                placeholder="tool_abc123"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Method</label>
              <Input
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                placeholder="analyze"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Cron Expression</label>
              <Input
                value={formCron}
                onChange={(e) => setFormCron(e.target.value)}
                placeholder="0 */6 * * *"
              />
            </div>
          </div>
          {formError && (
            <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
          )}
          <Button onClick={createSchedule} disabled={creating}>
            {creating ? 'Creating...' : 'Create Schedule'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Active Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No schedules yet. Create one above to automate your tool invocations.
            </p>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#161822] border border-gray-100 dark:border-[#252836]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {s.toolName || s.toolId}
                      </span>
                      <code className="text-xs bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded font-mono text-gray-600 dark:text-gray-400">
                        {s.method}
                      </code>
                      <Badge variant={s.enabled ? 'success' : 'secondary'} className="text-[10px]">
                        {s.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>Cron: <code className="font-mono">{s.cronExpression}</code></span>
                      {s.lastRunAt && <span>Last run: {formatDate(s.lastRunAt)}</span>}
                      {s.nextRunAt && <span>Next run: {formatDate(s.nextRunAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSchedule(s.id, s.enabled)}
                    >
                      {s.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSchedule(s.id)}
                      className="text-red-600 hover:text-red-700 border-red-200 dark:border-red-800/40"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Cron expressions use standard 5-field syntax (minute hour day-of-month month day-of-week). Minimum interval is 5 minutes.
        {' '}
        <Link href="/docs" className="text-brand hover:text-brand/80 transition-colors">
          See documentation
        </Link>
      </p>
    </div>
  )
}
