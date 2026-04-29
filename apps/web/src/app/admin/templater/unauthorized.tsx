import Link from 'next/link'

export default function TemplaterUnauthorized() {
  return (
    <div className="min-h-screen bg-[#0C0E14] flex items-center justify-center px-4">
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-gray-700 mb-4">401</h1>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          Authentication required
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Sign in to view Templater runs.
        </p>
        <Link
          href="/login?redirect=/admin/templater"
          className="inline-flex rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
