export default function ConsumerLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-56" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-32" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-64" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-24" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-72" />
      </div>
    </div>
  )
}
