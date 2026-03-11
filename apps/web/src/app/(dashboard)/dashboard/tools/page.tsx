'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Tool {
  id: string
  name: string
  slug: string
  description: string
  status: string
  totalInvocations: number
  totalRevenueCents: number
  pricingConfig: { defaultCostCents: number; methods?: Record<string, { costCents: number }> }
  createdAt: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', description: '', defaultCostCents: '1' })
  const [creating, setCreating] = useState(false)

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      if (!res.ok) { setError('Failed to load tools'); return }
      const data = await res.json()
      setTools(data.data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTools() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          pricingConfig: { defaultCostCents: parseInt(form.defaultCostCents, 10) },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create tool')
        return
      }
      setShowCreate(false)
      setForm({ name: '', slug: '', description: '', defaultCostCents: '1' })
      fetchTools()
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(toolId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active'
    try {
      const res = await fetch(`/api/tools/${toolId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to toggle status')
        return
      }
      fetchTools()
    } catch {
      setError('Failed to toggle status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo">Tools</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'New Tool'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create Tool</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tool-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input id="tool-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label htmlFor="tool-slug" className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input id="tool-slug" type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div>
                <label htmlFor="tool-desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="tool-desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand min-h-[80px]" />
              </div>
              <div className="w-48">
                <label htmlFor="tool-cost" className="block text-sm font-medium text-gray-700 mb-1">Default Cost (cents)</label>
                <input id="tool-cost" type="number" min="0" required value={form.defaultCostCents} onChange={(e) => setForm({ ...form, defaultCostCents: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
              </div>
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Tool'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-48 mb-2" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tools.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 mb-4">No tools yet. Create your first tool to start earning.</p>
            <Button onClick={() => setShowCreate(true)}>Create Tool</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-lg text-indigo">{tool.name}</h3>
                      <Badge variant={tool.status === 'active' ? 'success' : 'secondary'}>
                        {tool.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{tool.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>Slug: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{tool.slug}</code></span>
                      <span>{tool.totalInvocations.toLocaleString()} invocations</span>
                      <span>{formatCents(tool.totalRevenueCents)} revenue</span>
                      <span>{formatCents(tool.pricingConfig.defaultCostCents)}/call</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(tool.id, tool.status)}>
                      {tool.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Link href={`/tools/${tool.slug}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
