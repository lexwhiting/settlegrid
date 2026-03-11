import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-indigo mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-6">Page not found</p>
        <Link
          href="/"
          className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-dark transition-colors font-medium"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
