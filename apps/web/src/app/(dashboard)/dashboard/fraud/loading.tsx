export default function FraudLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 bg-gray-200 rounded animate-pulse w-56" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-80 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-36" />
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-14" />
            </div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-28" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
              <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
