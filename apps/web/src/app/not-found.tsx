import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function NotFound() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="mb-8">
            <Link href="/">
              <SettleGridLogo variant="horizontal" size={32} />
            </Link>
          </div>

          {/* Frozen gold drop — golden teardrop frozen mid-fall */}
          <div className="flex justify-center mb-6">
            <div className="frozen-drop" aria-hidden="true" />
          </div>

          <p className="text-6xl font-bold text-gold-settled/30 mb-2">404</p>
          <h1 className="text-xl font-semibold text-gray-100 mb-3">
            This page hasn&apos;t settled yet.
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            The value you&apos;re looking for may have flowed elsewhere.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/"
              className="bg-gradient-to-r from-gold-flowing to-gold-warm text-white px-6 py-2.5 rounded-lg hover:from-gold-molten hover:to-gold-flowing transition-all shadow-lg shadow-gold-flowing/20 font-medium text-sm"
            >
              Back to Home
            </Link>
            <Link
              href="/docs"
              className="border border-[#2A2D3E] text-gray-300 px-6 py-2.5 rounded-lg hover:border-gold-deep/40 hover:text-white transition-colors font-medium text-sm"
            >
              View Docs
            </Link>
          </div>
          <div className="flex items-center justify-center gap-5 text-xs text-gray-500">
            <Link href="/marketplace" className="hover:text-gold-molten transition-colors">Marketplace</Link>
            <Link href="/tools" className="hover:text-gold-molten transition-colors">Showcase</Link>
            <Link href="/learn" className="hover:text-gold-molten transition-colors">Learn</Link>
            <Link href="/faq" className="hover:text-gold-molten transition-colors">FAQ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
