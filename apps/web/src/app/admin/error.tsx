'use client'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#0C0E14] flex items-center justify-center px-4">
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-6">{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
