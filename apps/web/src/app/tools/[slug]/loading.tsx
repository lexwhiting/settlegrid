export default function ToolStorefrontLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-64" />
        <div className="h-5 bg-gray-200 rounded animate-pulse w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-24" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
            <div className="h-10 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-10 bg-gray-200 rounded animate-pulse w-full" />
          </div>
        </div>
      </main>
    </div>
  )
}
