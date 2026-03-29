import Link from 'next/link'
import { ToolTypeBadge, type ToolType } from '@/components/ui/tool-type-badge'
import { EcosystemIcon, type SourceEcosystem } from '@/components/ui/ecosystem-icon'

export interface MarketplaceTool {
  id: string
  name: string
  slug: string
  description: string | null
  toolType: string
  sourceEcosystem: string | null
  category: string | null
  status: string
  totalInvocations: number
  totalRevenueCents: number
  verified: boolean
  createdAt: string
}

function formatInvocations(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

interface ToolCardProps {
  tool: MarketplaceTool
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-all hover:shadow-[0_4px_16px_-2px_rgba(229,163,54,0.12)]"
    >
      {/* Header: name + badges */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors leading-tight line-clamp-1">
          {tool.name}
        </h3>
        {tool.verified && (
          <svg
            className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-label="Verified"
          >
            <path
              fillRule="evenodd"
              d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-1.29-1.29 3 3 0 01-5.304 0 3 3 0 00-1.29 1.29 3 3 0 010 5.304 3 3 0 001.29 1.29 3 3 0 015.304 0 3 3 0 001.29-1.29zM10 12a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Description */}
      {tool.description && (
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-3">
          {tool.description}
        </p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <ToolTypeBadge type={tool.toolType as ToolType} />
        {tool.category && (
          <span className="inline-flex items-center rounded-full bg-[#252836] text-gray-300 border border-[#2A2D3E] px-2 py-0.5 text-[10px] font-medium capitalize">
            {tool.category}
          </span>
        )}
        <EcosystemIcon ecosystem={tool.sourceEcosystem as SourceEcosystem} />
      </div>

      {/* Footer: stats */}
      <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            {formatInvocations(tool.totalInvocations)} calls
          </span>
          {tool.status === 'active' && tool.totalRevenueCents === 0 && !tool.verified && (
            <span className="text-[10px] text-gray-500 bg-[#252836] px-1.5 py-0.5 rounded">
              Unclaimed
            </span>
          )}
        </div>
        <span className="text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
          View &rarr;
        </span>
      </div>
    </Link>
  )
}
