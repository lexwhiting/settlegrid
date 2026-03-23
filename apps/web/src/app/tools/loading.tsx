export default function ShowcaseLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1D2E]">
      <header className="bg-white dark:bg-[#1A1D2E] border-b border-gray-200 dark:border-[#2E3148] px-6 py-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-64" />
        <div className="h-5 bg-gray-200 rounded animate-pulse w-96" />
        <div className="flex gap-4">
          <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
          <div className="w-48 h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] p-6 space-y-3">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-40" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
