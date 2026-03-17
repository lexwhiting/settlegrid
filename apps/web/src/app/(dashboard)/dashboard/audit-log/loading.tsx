import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function AuditLogLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />
      <div className="flex gap-4">
        <Skeleton className="w-56 h-10" />
        <Skeleton className="w-56 h-10" />
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-[#252836]">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
