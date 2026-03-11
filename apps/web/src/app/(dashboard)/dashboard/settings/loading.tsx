export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <div className="h-5 bg-gray-200 rounded animate-pulse w-32 mb-3" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-full" />
        </div>
        <div>
          <div className="h-5 bg-gray-200 rounded animate-pulse w-40 mb-3" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-full" />
        </div>
        <div>
          <div className="h-5 bg-gray-200 rounded animate-pulse w-36 mb-3" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-64" />
        </div>
      </div>
    </div>
  )
}
