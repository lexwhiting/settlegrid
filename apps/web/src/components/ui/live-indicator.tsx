interface LiveIndicatorProps {
  /** Whether the connection is active */
  connected: boolean
  /** Optional label override */
  label?: string
}

export function LiveIndicator({ connected, label = 'Live' }: LiveIndicatorProps) {
  if (!connected) return null

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text dark:text-brand-light">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
      </span>
      {label}
    </div>
  )
}
