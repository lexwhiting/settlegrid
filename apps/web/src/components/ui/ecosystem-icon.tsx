import { cn } from '@/lib/utils'

export type SourceEcosystem =
  | 'mcp-registry'
  | 'pulsemcp'
  | 'smithery'
  | 'npm'
  | 'pypi'
  | 'huggingface'
  | 'replicate'
  | 'apify'
  | 'openrouter'
  | 'github'

const ECOSYSTEM_CONFIG: Record<
  SourceEcosystem,
  { label: string; abbr: string; color: string; bg: string }
> = {
  'mcp-registry': {
    label: 'MCP Registry',
    abbr: 'MCP',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  pulsemcp: {
    label: 'PulseMCP',
    abbr: 'PMC',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  smithery: {
    label: 'Smithery',
    abbr: 'SMT',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  npm: {
    label: 'npm',
    abbr: 'npm',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  pypi: {
    label: 'PyPI',
    abbr: 'PyPI',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  huggingface: {
    label: 'Hugging Face',
    abbr: 'HF',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  replicate: {
    label: 'Replicate',
    abbr: 'REP',
    color: 'text-slate-300',
    bg: 'bg-slate-500/10',
  },
  apify: {
    label: 'Apify',
    abbr: 'API',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  openrouter: {
    label: 'OpenRouter',
    abbr: 'OR',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  github: {
    label: 'GitHub',
    abbr: 'GH',
    color: 'text-gray-300',
    bg: 'bg-gray-500/10',
  },
}

interface EcosystemIconProps {
  ecosystem: SourceEcosystem | null | undefined
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function EcosystemIcon({
  ecosystem,
  className,
  showLabel = false,
  size = 'sm',
}: EcosystemIconProps) {
  if (!ecosystem) return null

  const config = ECOSYSTEM_CONFIG[ecosystem]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-mono font-semibold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.bg,
        config.color,
        className
      )}
      title={config.label}
    >
      {config.abbr}
      {showLabel && (
        <span className="font-sans font-normal text-gray-400 ml-0.5">{config.label}</span>
      )}
    </span>
  )
}

export function getEcosystemLabel(ecosystem: SourceEcosystem): string {
  return ECOSYSTEM_CONFIG[ecosystem]?.label ?? ecosystem
}

export function getEcosystemSlug(ecosystem: SourceEcosystem): string {
  return ecosystem
}

/** All ecosystems for filter UIs */
export const ALL_ECOSYSTEMS = Object.entries(ECOSYSTEM_CONFIG).map(([key, val]) => ({
  value: key as SourceEcosystem,
  label: val.label,
  abbr: val.abbr,
}))

export { ECOSYSTEM_CONFIG }
