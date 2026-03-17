import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#252836] flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-indigo dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button size="sm">{actionLabel}</Button>
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}
