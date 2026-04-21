import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function AcademyLessonLoading() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div
          className="max-w-3xl mx-auto animate-pulse"
          aria-busy="true"
          aria-label="Loading lesson"
        >
          {/* Breadcrumb skeleton */}
          <div className="h-4 w-48 bg-[#161822] rounded mb-8" />

          {/* Header skeleton */}
          <div className="mb-12 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-24 bg-[#161822] rounded-full" />
              <div className="h-3 w-20 bg-[#161822] rounded" />
              <div className="h-3 w-32 bg-[#161822] rounded" />
            </div>
            <div className="h-10 w-11/12 bg-[#161822] rounded" />
            <div className="h-10 w-8/12 bg-[#161822] rounded" />
            <div className="h-5 w-full bg-[#161822] rounded" />
            <div className="h-5 w-5/6 bg-[#161822] rounded" />
          </div>

          {/* TOC skeleton */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12 space-y-2">
            <div className="h-3 w-24 bg-[#0C0E14] rounded" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-10/12 bg-[#0C0E14] rounded" />
            ))}
          </div>

          {/* Body skeleton */}
          <div className="space-y-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-full bg-[#161822] rounded" />
                <div className="h-4 w-11/12 bg-[#161822] rounded" />
                <div className="h-4 w-9/12 bg-[#161822] rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
