export default function AuditLogLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-36" />
      <div className="flex gap-4">
        <div className="w-56 h-10 bg-gray-200 rounded animate-pulse" />
        <div className="w-56 h-10 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-32 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
            <div className="h-5 bg-gray-200 rounded-full animate-pulse w-28" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
            <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
