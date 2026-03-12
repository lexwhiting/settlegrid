export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 bg-gray-200 rounded animate-pulse w-44" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-72 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-32 mb-4" />
        <div className="flex items-end gap-1 h-32">
          {Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 rounded-t animate-pulse"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
