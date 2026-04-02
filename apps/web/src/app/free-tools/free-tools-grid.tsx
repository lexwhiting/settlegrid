'use client'

import { useState, useCallback } from 'react'

interface FreeToolDef {
  slug: string
  name: string
  description: string
  category: string
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [url])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      aria-label={copied ? 'Copied' : 'Copy endpoint URL'}
    >
      {copied ? 'Copied' : 'Copy URL'}
    </button>
  )
}

export function FreeToolsGrid({ tools }: { tools: FreeToolDef[] }) {
  const categories = Array.from(new Set(tools.map((t) => t.category))).sort()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filteredTools = activeCategory
    ? tools.filter((t) => t.category === activeCategory)
    : tools

  return (
    <div>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            activeCategory === null
              ? 'bg-[#E5A336] text-[#0a0a0a] border-[#E5A336]'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
          }`}
        >
          All ({tools.length})
        </button>
        {categories.map((cat) => {
          const count = tools.filter((t) => t.category === cat).length
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeCategory === cat
                  ? 'bg-[#E5A336] text-[#0a0a0a] border-[#E5A336]'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Tool cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const serveUrl = `https://settlegrid.ai/api/tools/serve/${tool.slug}`

          return (
            <div
              key={tool.slug}
              className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-[#E5A336]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{tool.name}</h3>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                  {tool.category}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {tool.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <a
                  href={serveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#E5A336] hover:underline"
                >
                  Try it
                </a>
                <CopyButton url={serveUrl} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
