'use client'

import { useState, useCallback } from 'react'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface ContactFormProps {
  onClose: () => void
  pageUrl?: string
}

export function ContactForm({ onClose, pageUrl }: ContactFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, pageUrl }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }, [name, email, subject, message, pageUrl])

  if (status === 'success') {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Message sent!</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          We&apos;ll respond within 24 hours.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
        >
          Back to chat
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <div>
        <label htmlFor="support-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Name
        </label>
        <input
          id="support-name"
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#151726] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="support-email" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email
        </label>
        <input
          id="support-email"
          type="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#151726] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="support-subject" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Subject
        </label>
        <input
          id="support-subject"
          type="text"
          required
          maxLength={300}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#151726] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
          placeholder="What do you need help with?"
        />
      </div>

      <div>
        <label htmlFor="support-message" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Message
        </label>
        <textarea
          id="support-message"
          required
          maxLength={5000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#151726] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
          placeholder="Describe your issue or question..."
        />
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-500 dark:text-red-400">{errorMsg}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="flex-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 transition-colors"
        >
          {status === 'submitting' ? 'Sending...' : 'Send Message'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
