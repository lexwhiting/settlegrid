import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

interface ProfileData {
  name: string
  slug: string | null
  bio: string | null
  avatarUrl: string | null
  joinedAt: string
  stats: {
    toolCount: number
    totalInvocations: number
    avgResponseTimeMs: number
  }
  tools: {
    name: string
    slug: string
    category: string | null
    totalInvocations: number
    averageRating: number
  }[]
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ))}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

async function getProfile(id: string): Promise<ProfileData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'
    const res = await fetch(`${baseUrl}/api/developers/${id}/profile`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json.data ?? json) as ProfileData
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) return { title: 'Profile Not Found | SettleGrid' }
  const canonicalSlug = profile.slug ?? id
  return {
    title: `${profile.name} | SettleGrid Developer`,
    description: profile.bio
      ? `${profile.bio.slice(0, 150)} — ${profile.stats.toolCount} tools on SettleGrid.`
      : `${profile.name} has ${profile.stats.toolCount} tools on SettleGrid.`,
    alternates: { canonical: `https://settlegrid.ai/developers/${canonicalSlug}` },
    openGraph: {
      title: `${profile.name} | SettleGrid Developer`,
      description: profile.bio || `Developer profile for ${profile.name} on SettleGrid.`,
      type: 'profile',
    },
  }
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfile(id)

  if (!profile) {
    return (
      <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
        <header className="border-b border-[#2E3148] px-6 py-4">
          <nav className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/">
              <SettleGridLogo variant="horizontal" size={28} />
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
                Showcase
              </Link>
              <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">
                Log in
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D2E] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Profile not found</h1>
            <p className="text-gray-400 text-sm mb-6 max-w-md">
              This developer profile is either private or does not exist.
            </p>
            <Link href="/tools" className="text-sm font-medium bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-colors">
              Browse Showcase
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const initials = (profile.name ?? 'D')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const joinDate = new Date(profile.joinedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#2E3148] px-6 py-4">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Developer Info */}
          <div className="flex items-start gap-6 mb-10">
            {profile.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#2E3148]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center border-2 border-[#2E3148] shrink-0">
                <span className="text-2xl font-bold text-brand-text">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-bold mb-1">{profile.name}</h1>
              <p className="text-sm text-gray-400 mb-3">Joined {joinDate}</p>
              {profile.bio && (
                <p className="text-gray-300 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 text-center">
              <p className="text-2xl font-bold text-brand-text">{profile.stats.toolCount}</p>
              <p className="text-sm text-gray-400 mt-1">Tools</p>
            </div>
            <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 text-center">
              <p className="text-2xl font-bold text-brand-text">{formatNumber(profile.stats.totalInvocations)}</p>
              <p className="text-sm text-gray-400 mt-1">Total Invocations</p>
            </div>
            <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 text-center">
              <p className="text-2xl font-bold text-brand-text">
                {profile.stats.avgResponseTimeMs > 0 ? `${Math.round(profile.stats.avgResponseTimeMs)}ms` : '--'}
              </p>
              <p className="text-sm text-gray-400 mt-1">Avg Response</p>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Tools</h2>
            {profile.tools.length === 0 ? (
              <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-8 text-center">
                <p className="text-gray-400 text-sm">No published tools yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 hover:border-brand/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-100 group-hover:text-brand-text transition-colors">
                        {tool.name}
                      </h3>
                      {tool.category && (
                        <span className="inline-flex items-center rounded-full bg-brand/10 text-brand-text px-2 py-0.5 text-xs font-semibold shrink-0 ml-2">
                          {tool.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tool.averageRating > 0 ? (
                          <>
                            <StarRating rating={tool.averageRating} />
                            <span className="text-xs text-gray-400">{tool.averageRating.toFixed(1)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">No ratings</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatNumber(tool.totalInvocations)} calls
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          Powered by <Link href="/" className="text-brand-text hover:text-brand-dark">SettleGrid</Link>
        </div>
      </footer>
    </div>
  )
}
