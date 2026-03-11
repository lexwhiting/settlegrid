export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
