import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-[#252836]', className)}
      {...props}
    />
  )
}

export { Skeleton }
