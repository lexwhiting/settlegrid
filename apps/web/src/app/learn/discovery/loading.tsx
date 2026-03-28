export default function DiscoveryGuideLoading() {
  return (
    <div className="min-h-screen bg-[#0C0E14]">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="h-7 w-32 bg-[#2A2D3E] rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-5 w-12 bg-[#2A2D3E] rounded animate-pulse" />
            <div className="h-5 w-12 bg-[#2A2D3E] rounded animate-pulse" />
            <div className="h-9 w-28 bg-[#2A2D3E] rounded-lg animate-pulse" />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-4 mb-16">
          <div className="h-6 w-56 bg-[#2A2D3E] rounded-full animate-pulse mx-auto" />
          <div className="h-12 w-80 bg-[#2A2D3E] rounded animate-pulse mx-auto" />
          <div className="h-5 w-96 bg-[#2A2D3E] rounded animate-pulse mx-auto" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-4 w-16 bg-amber-500/20 rounded animate-pulse" />
            <div className="h-8 w-64 bg-[#2A2D3E] rounded animate-pulse" />
            <div className="h-4 w-full bg-[#2A2D3E] rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-[#2A2D3E] rounded animate-pulse" />
            <div className="h-20 w-full bg-[#161822] border border-[#2A2D3E] rounded-xl animate-pulse" />
          </div>
        ))}
      </main>
    </div>
  )
}
