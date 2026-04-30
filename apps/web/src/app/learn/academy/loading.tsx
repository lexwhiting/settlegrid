import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function AcademyLandingLoading() {
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
          aria-label="Loading Academy lessons"
        >
          {/* Breadcrumb skeleton */}
          <div className="h-4 w-32 bg-[#161822] rounded mb-8" />

          {/* Hero skeleton */}
          <div className="mb-10 space-y-4">
            <div className="h-5 w-24 bg-[#161822] rounded-full" />
            <div className="h-10 w-3/4 bg-[#161822] rounded" />
            <div className="h-5 w-full bg-[#161822] rounded" />
            <div className="h-5 w-5/6 bg-[#161822] rounded" />
          </div>

          {/* Lesson card skeletons */}
          <ul className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 space-y-3"
              >
                <div className="h-3 w-48 bg-[#0C0E14] rounded" />
                <div className="h-6 w-10/12 bg-[#0C0E14] rounded" />
                <div className="h-4 w-full bg-[#0C0E14] rounded" />
                <div className="h-4 w-9/12 bg-[#0C0E14] rounded" />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
