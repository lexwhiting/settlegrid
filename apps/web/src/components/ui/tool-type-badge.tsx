import { cn } from '@/lib/utils'

export type ToolType =
  | 'mcp-server'
  | 'ai-model'
  | 'rest-api'
  | 'agent-tool'
  | 'automation'
  | 'extension'
  | 'dataset'
  | 'sdk-package'

const TOOL_TYPE_CONFIG: Record<ToolType, { label: string; color: string }> = {
  'mcp-server': {
    label: 'MCP Server',
    color: 'bg-[#E5A336]/15 text-[#E5A336] border-[#E5A336]/25',
  },
  'ai-model': {
    label: 'AI Model',
    color: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/25',
  },
  'rest-api': {
    label: 'REST API',
    color: 'bg-[#0EA5E9]/15 text-[#0EA5E9] border-[#0EA5E9]/25',
  },
  'agent-tool': {
    label: 'Agent Tool',
    color: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25',
  },
  automation: {
    label: 'Automation',
    color: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/25',
  },
  extension: {
    label: 'Extension',
    color: 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/25',
  },
  dataset: {
    label: 'Dataset',
    color: 'bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/25',
  },
  'sdk-package': {
    label: 'SDK Package',
    color: 'bg-[#6366F1]/15 text-[#6366F1] border-[#6366F1]/25',
  },
}

interface ToolTypeBadgeProps {
  type: ToolType
  className?: string
  size?: 'sm' | 'md'
}

export function ToolTypeBadge({ type, className, size = 'sm' }: ToolTypeBadgeProps) {
  const config = TOOL_TYPE_CONFIG[type]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export function getToolTypeLabel(type: ToolType): string {
  return TOOL_TYPE_CONFIG[type]?.label ?? type
}

export { TOOL_TYPE_CONFIG }
