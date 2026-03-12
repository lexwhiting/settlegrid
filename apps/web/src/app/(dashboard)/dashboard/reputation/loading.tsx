export default function ReputationLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 bg-gray-200 rounded animate-pulse w-52" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-80 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="h-28 w-28 bg-gray-200 rounded-full animate-pulse mx-auto mb-4" />
          <div className="h-8 bg-gray-200 rounded animate-pulse w-20 mx-auto mb-2" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-28 mx-auto" />
        </div>
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-40 mb-6" />
          <div className="space-y-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-36" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full animate-pulse w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-56 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 border border-gray-100 rounded-lg p-4">
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-14" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-2" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
