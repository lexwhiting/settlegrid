export default function DocsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-48" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-7 bg-gray-200 rounded animate-pulse w-56" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5" />
            <div className="h-24 bg-gray-200 rounded animate-pulse w-full" />
          </div>
        ))}
      </main>
    </div>
  )
}
