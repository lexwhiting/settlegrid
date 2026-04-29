import Link from 'next/link'

export default function TemplaterForbidden() {
  return (
    <div className="min-h-screen bg-[#0C0E14] flex items-center justify-center px-4">
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-gray-700 mb-4">403</h1>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          Admin access required
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Your account does not have permission to view this page.
        </p>
        <Link
          href="/"
          className="inline-flex text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
