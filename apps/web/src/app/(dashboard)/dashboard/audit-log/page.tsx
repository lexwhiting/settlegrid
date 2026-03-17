'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface AuditEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string
  ip: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

const ACTION_TYPES = [
  'All',
  'tool.created',
  'tool.updated',
  'tool.activated',
  'tool.deactivated',
  'key.created',
  'key.revoked',
  'credit.purchased',
  'payout.requested',
  'webhook.created',
  'webhook.deleted',
  'login',
  'logout',
] as const

const RESOURCE_TYPES = [
  'All',
  'tool',
  'apiKey',
  'credit',
  'payout',
  'webhook',
  'session',
] as const

const PAGE_SIZE = 20

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [resourceFilter, setResourceFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (actionFilter !== 'All') params.set('action', actionFilter)
      if (resourceFilter !== 'All') params.set('resourceType', resourceFilter)

      const res = await fetch(`/api/dashboard/developer/audit-log?${params}`)
      if (!res.ok) {
        setError('Failed to load audit log')
        return
      }
      const data = await res.json()
      setEntries(data.data ?? [])
      setTotalCount(data.total ?? 0)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, resourceFilter])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  function handleFilterChange(type: 'action' | 'resource', value: string) {
    setPage(1)
    if (type === 'action') setActionFilter(value)
    else setResourceFilter(value)
  }

  async function exportCsv() {
    setExporting(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'All') params.set('action', actionFilter)
      if (resourceFilter !== 'All') params.set('resourceType', resourceFilter)
      params.set('format', 'csv')

      const res = await fetch(`/api/dashboard/developer/audit-log?${params}`)
      if (!res.ok) {
        setError('Failed to export audit log')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const actionBadgeVariant = (action: string) => {
    if (action.includes('created') || action.includes('activated') || action === 'login') return 'success' as const
    if (action.includes('deleted') || action.includes('revoked') || action.includes('deactivated')) return 'destructive' as const
    if (action.includes('updated') || action.includes('requested')) return 'warning' as const
    return 'secondary' as const
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Audit Log' },
      ]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo">Audit Log</h1>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-56">
          <label htmlFor="audit-action-filter" className="block text-sm font-medium text-gray-700 mb-1">Action</label>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {ACTION_TYPES.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="audit-resource-filter" className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
          <select
            id="audit-resource-filter"
            value={resourceFilter}
            onChange={(e) => handleFilterChange('resource', e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {RESOURCE_TYPES.map((resource) => (
              <option key={resource} value={resource}>{resource}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {totalCount > 0 ? `${totalCount.toLocaleString()} entries` : 'Audit Entries'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-gray-500 text-sm">No audit entries match your filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Audit log entries">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Resource</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Resource ID</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">IP Address</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <Badge variant={actionBadgeVariant(entry.action)}>{entry.action}</Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{entry.resourceType}</td>
                        <td className="py-3 px-4">
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-600">
                            {entry.resourceId.slice(0, 12)}...
                          </code>
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-xs">{entry.ip}</td>
                        <td className="py-3 px-4 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
