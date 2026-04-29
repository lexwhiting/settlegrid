import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { TemplateManifest } from '@/lib/registry-helpers'

interface TemplateCardProps {
  template: TemplateManifest
}

const CATEGORY_COLORS: Record<string, string> = {
  devtools: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  media: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  research: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  data: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ai: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  infra: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  productivity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  finance: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  commerce: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export function TemplateCard({ template }: TemplateCardProps) {
  const catColor =
    CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.other

  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-[#E5A336]/40 dark:border-[#2A2D3E] dark:bg-[#161822] dark:hover:border-[#E5A336]/40"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-foreground group-hover:text-[#E5A336] transition-colors line-clamp-1">
          {template.name}
        </h3>
        {template.featured && (
          <Badge variant="default" className="shrink-0 text-[10px]">
            Featured
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {template.description}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${catColor}`}
        >
          {template.category}
        </span>
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-muted-foreground dark:border-[#2A2D3E]"
          >
            {tag}
          </span>
        ))}
        {template.tags.length > 3 && (
          <span className="text-[11px] text-muted-foreground">
            +{template.tags.length - 3}
          </span>
        )}
      </div>
    </Link>
  )
}
