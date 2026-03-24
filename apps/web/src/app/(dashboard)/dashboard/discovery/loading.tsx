import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function DiscoveryLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-5 w-40" />
      <div>
        <Skeleton className="h-8 w-48 mb-1" />
        <Skeleton className="h-4 w-80" />
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
