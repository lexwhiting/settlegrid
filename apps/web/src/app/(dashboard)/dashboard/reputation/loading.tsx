import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function ReputationLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-8 text-center">
            <Skeleton className="h-28 w-28 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-20 mx-auto mb-2" />
            <Skeleton className="h-4 w-28 mx-auto" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-6" />
            <div className="space-y-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-5 w-56 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                <Skeleton className="h-5 w-14 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
