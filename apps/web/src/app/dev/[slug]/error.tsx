'use client'

import Link from 'next/link'

export default function DevProfileError() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-[#1A1D2E] border border-[#2E3148] flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-3">Something went wrong</h1>
          <p className="text-gray-400 mb-6">
            We couldn&apos;t load this developer profile. Please try again later.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/tools" className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors">
              Browse Showcase
            </Link>
            <Link href="/" className="text-gray-400 hover:text-gray-200 font-medium transition-colors">
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
