export default function DevelopersLoading() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* Header skeleton */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-7 w-32 rounded bg-[#2E3148] animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 rounded bg-[#2E3148] animate-pulse hidden sm:block" />
            <div className="h-4 w-16 rounded bg-[#2E3148] animate-pulse hidden sm:block" />
            <div className="h-9 w-28 rounded-lg bg-[#2E3148] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero skeleton */}
          <div className="text-center mb-14">
            <div className="h-12 w-80 mx-auto rounded bg-[#2E3148] animate-pulse mb-4" />
            <div className="h-5 w-56 mx-auto rounded bg-[#2E3148] animate-pulse" />
          </div>

          {/* Card grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#2E3148] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-28 rounded bg-[#2E3148] animate-pulse mb-2" />
                    <div className="h-3 w-20 rounded bg-[#2E3148] animate-pulse" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-[#2E3148] animate-pulse mb-2" />
                <div className="h-3 w-3/4 rounded bg-[#2E3148] animate-pulse mb-4" />
                <div className="flex items-center justify-between">
                  <div className="h-6 w-20 rounded-full bg-[#2E3148] animate-pulse" />
                  <div className="h-3 w-12 rounded bg-[#2E3148] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
