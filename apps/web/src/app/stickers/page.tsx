'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Sticker Concepts                                                           */
/* -------------------------------------------------------------------------- */

const STICKER_CONCEPTS = [
  {
    name: 'The Grid',
    description: 'The FlowGrid logo in amber-gold on a dark matte background. Clean, geometric, unmistakable.',
    color: 'bg-amber-500/10 border-amber-500/30',
    accentColor: 'text-amber-400',
  },
  {
    name: 'Keep 100%',
    description: 'Bold white text on black. A statement sticker for developers who keep every dollar of their first $1K/month.',
    color: 'bg-white/5 border-white/20',
    accentColor: 'text-white',
  },
  {
    name: 'Settle This.',
    description: 'Playful double-meaning in a rounded badge. Settle your payments. Settle your debates. Either way, you win.',
    color: 'bg-amber-500/10 border-amber-500/30',
    accentColor: 'text-amber-400',
  },
  {
    name: 'Per Call. Not Per Prayer.',
    description: 'Developer humor in a monospace font. Because billing should be predictable, not hopeful.',
    color: 'bg-green-500/10 border-green-500/30',
    accentColor: 'text-green-400',
  },
]

/* -------------------------------------------------------------------------- */
/*  Sticker Request Form                                                       */
/* -------------------------------------------------------------------------- */

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

export default function StickersPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/stickers/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          street,
          city,
          stateProvince,
          postalCode,
          country,
        }),
      })

      if (res.ok) {
        setStatus('success')
      } else {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Get SettleGrid stickers for your laptop
            </h1>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">
              Free sticker pack. No strings attached. Just good design for developers who appreciate good billing infrastructure.
            </p>
          </div>

          {/* Sticker Concepts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
            {STICKER_CONCEPTS.map((sticker) => (
              <div
                key={sticker.name}
                className={`rounded-xl border p-6 ${sticker.color}`}
              >
                <h2 className={`text-xl font-bold mb-2 ${sticker.accentColor}`}>
                  &ldquo;{sticker.name}&rdquo;
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {sticker.description}
                </p>
              </div>
            ))}
          </div>

          {/* Form or Success */}
          {status === 'success' ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Sticker pack requested!</h2>
              <p className="text-gray-400">
                We&apos;ll ship it within 2 weeks. Keep building.
              </p>
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-8">
              <h2 className="text-xl font-bold text-gray-100 mb-6">
                Request your free sticker pack
              </h2>

              {status === 'error' && errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-sm text-red-400" role="alert">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="sticker-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Name
                    </label>
                    <input
                      id="sticker-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="Jane Developer"
                    />
                  </div>
                  <div>
                    <label htmlFor="sticker-email" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      id="sticker-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sticker-street" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Street Address
                  </label>
                  <input
                    id="sticker-street"
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                    placeholder="123 API Street, Apt 4"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="sticker-city" className="block text-sm font-medium text-gray-300 mb-1.5">
                      City
                    </label>
                    <input
                      id="sticker-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <label htmlFor="sticker-state" className="block text-sm font-medium text-gray-300 mb-1.5">
                      State / Province
                    </label>
                    <input
                      id="sticker-state"
                      type="text"
                      required
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="sticker-postal" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Postal Code
                    </label>
                    <input
                      id="sticker-postal"
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="94107"
                    />
                  </div>
                  <div>
                    <label htmlFor="sticker-country" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Country
                    </label>
                    <input
                      id="sticker-country"
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2D3E] bg-[#0C0E14] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                      placeholder="United States"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {status === 'submitting' ? 'Submitting...' : 'Request Free Sticker Pack'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
