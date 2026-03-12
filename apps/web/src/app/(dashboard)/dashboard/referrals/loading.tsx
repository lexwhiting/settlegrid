export default function ReferralsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded animate-pulse w-44" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-72 mt-2" />
        </div>
        <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-36 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
              <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
