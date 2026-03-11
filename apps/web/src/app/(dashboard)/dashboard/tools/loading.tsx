export default function ToolsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
        <div className="h-10 bg-gray-200 rounded animate-pulse w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-40 mb-3" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-4" />
            <div className="flex gap-2">
              <div className="h-6 bg-gray-200 rounded-full animate-pulse w-16" />
              <div className="h-6 bg-gray-200 rounded-full animate-pulse w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
