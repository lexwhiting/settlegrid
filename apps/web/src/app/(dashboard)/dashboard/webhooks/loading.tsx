export default function WebhooksLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-36" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-64 mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mb-2" />
            <div className="flex gap-2">
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-24" />
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-20" />
              <div className="h-5 bg-gray-200 rounded-full animate-pulse w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
