import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function NotFound() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="mb-8">
            <Link href="/">
              <SettleGridLogo variant="horizontal" size={32} />
            </Link>
          </div>
          <p className="text-8xl font-bold text-gray-700 mb-2">404</p>
          <h1 className="text-xl font-semibold text-gray-100 mb-3">Page not found</h1>
          <p className="text-sm text-gray-400 mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/"
              className="bg-brand text-white px-6 py-2.5 rounded-lg hover:bg-brand-dark transition-colors font-medium text-sm"
            >
              Back to Home
            </Link>
            <Link
              href="/docs"
              className="border border-[#2E3148] text-gray-300 px-6 py-2.5 rounded-lg hover:border-gray-500 hover:text-white transition-colors font-medium text-sm"
            >
              View Docs
            </Link>
          </div>
          <div className="flex items-center justify-center gap-5 text-xs text-gray-500">
            <Link href="/tools" className="hover:text-gray-300 transition-colors">Showcase</Link>
            <Link href="/servers" className="hover:text-gray-300 transition-colors">Templates</Link>
            <Link href="/learn" className="hover:text-gray-300 transition-colors">Learn</Link>
            <Link href="/faq" className="hover:text-gray-300 transition-colors">FAQ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
