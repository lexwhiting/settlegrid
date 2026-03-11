export default function PayoutsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
        <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-36" />
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
              <div className="h-6 bg-gray-200 rounded-full animate-pulse w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
