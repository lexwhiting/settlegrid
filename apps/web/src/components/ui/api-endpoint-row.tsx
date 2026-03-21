'use client'

import { useState } from 'react'

export function ApiEndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const methodColor =
    method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
    : method === 'POST' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'

  function handleCopy() {
    navigator.clipboard.writeText(path)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group flex items-center gap-3 py-2 border-b border-gray-100 dark:border-[#252836]">
      <span className={`text-xs font-mono px-2 py-1 rounded ${methodColor}`}>
        {method}
      </span>
      <code className="text-sm text-indigo dark:text-gray-100">{path}</code>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-[#252836]"
        aria-label={`Copy ${path}`}
        title="Copy endpoint path"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">{desc}</span>
    </div>
  )
}
