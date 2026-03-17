'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'

const pages = [
  { name: 'Dashboard', href: '/dashboard', group: 'Navigation' },
  { name: 'Tools', href: '/dashboard/tools', group: 'Navigation' },
  { name: 'Analytics', href: '/dashboard/analytics', group: 'Navigation' },
  { name: 'Health', href: '/dashboard/health', group: 'Navigation' },
  { name: 'Payouts', href: '/dashboard/payouts', group: 'Navigation' },
  { name: 'Referrals', href: '/dashboard/referrals', group: 'Navigation' },
  { name: 'Fraud Detection', href: '/dashboard/fraud', group: 'Navigation' },
  { name: 'Reputation', href: '/dashboard/reputation', group: 'Navigation' },
  { name: 'Webhooks', href: '/dashboard/webhooks', group: 'Navigation' },
  { name: 'Audit Log', href: '/dashboard/audit-log', group: 'Navigation' },
  { name: 'Settings', href: '/dashboard/settings', group: 'Navigation' },
  { name: 'Consumer Dashboard', href: '/consumer', group: 'Navigation' },
  { name: 'Marketplace', href: '/tools', group: 'Navigation' },
  { name: 'Documentation', href: '/docs', group: 'Navigation' },
  { name: 'Create Tool', href: '/dashboard/tools', group: 'Actions' },
  { name: 'Add Webhook', href: '/dashboard/webhooks', group: 'Actions' },
  { name: 'Export Audit Log', href: '/dashboard/audit-log', group: 'Actions' },
  { name: 'Request Payout', href: '/dashboard/payouts', group: 'Actions' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          label="Command palette"
        >
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-4">
            <svg className="w-4 h-4 text-gray-400 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <Command.Input
              placeholder="Search pages and actions..."
              className="w-full h-12 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>
            {(['Navigation', 'Actions'] as const).map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {pages
                  .filter((p) => p.group === group)
                  .map((page) => (
                    <Command.Item
                      key={page.href + page.name}
                      value={page.name}
                      onSelect={() => navigate(page.href)}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-gray-700 dark:text-gray-300 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={
                          group === 'Actions'
                            ? 'M12 4.5v15m7.5-7.5h-15'
                            : 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3'
                        } />
                      </svg>
                      {page.name}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
