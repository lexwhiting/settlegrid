import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <SettleGridLogo variant="horizontal" size={32} />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-indigo hover:text-brand-dark transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <div className="flex justify-center mb-8">
            <SettleGridLogo variant="mark" size={72} />
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-indigo mb-6">
            The Settlement Layer for the{' '}
            <span className="text-brand">AI Economy</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Monetize your AI tools with per-call billing, automated Stripe
            Connect payouts, and a unified API gateway. Ship tools, earn money,
            and let SettleGrid handle the rest.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors"
            >
              Start Building
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center border-2 border-indigo text-indigo font-semibold px-8 py-3 rounded-lg text-lg hover:bg-indigo hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-xl border border-gray-200 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-indigo mb-2">Per-Call Billing</h3>
              <p className="text-sm text-gray-600">
                Charge consumers per API call with configurable pricing tiers.
                Prepaid balances with optional auto-refill.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-gray-200 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-indigo mb-2">Developer Payouts</h3>
              <p className="text-sm text-gray-600">
                Automated Stripe Connect payouts on your schedule. Weekly or
                monthly, with configurable minimums.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-gray-200 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-indigo mb-2">MCP-Ready SDK</h3>
              <p className="text-sm text-gray-600">
                Wrap any function as a monetized MCP tool with our TypeScript
                SDK. One decorator, instant billing.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
