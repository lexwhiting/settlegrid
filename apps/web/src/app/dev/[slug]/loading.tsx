export default function DevProfileLoading() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-7 w-32 rounded bg-[#252836] animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-5 w-16 rounded bg-[#252836] animate-pulse" />
            <div className="h-5 w-12 rounded bg-[#252836] animate-pulse" />
            <div className="h-9 w-20 rounded-lg bg-[#252836] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Developer Info skeleton */}
          <div className="flex items-start gap-6 mb-10">
            <div className="w-20 h-20 rounded-full bg-[#161822] border-2 border-[#2A2D3E] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
              <div className="h-8 w-48 rounded bg-[#252836] animate-pulse" />
              <div className="h-4 w-32 rounded bg-[#252836] animate-pulse" />
              <div className="h-4 w-80 rounded bg-[#252836] animate-pulse" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 text-center">
                <div className="h-7 w-12 mx-auto rounded bg-[#252836] animate-pulse mb-2" />
                <div className="h-4 w-16 mx-auto rounded bg-[#252836] animate-pulse" />
              </div>
            ))}
          </div>

          {/* Tools skeleton */}
          <div className="space-y-4">
            <div className="h-6 w-20 rounded bg-[#252836] animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5">
                  <div className="h-5 w-32 rounded bg-[#252836] animate-pulse mb-3" />
                  <div className="h-4 w-full rounded bg-[#252836] animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-[#252836] animate-pulse mb-4" />
                  <div className="h-px bg-[#252836] mb-3" />
                  <div className="h-4 w-16 rounded bg-[#252836] animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
