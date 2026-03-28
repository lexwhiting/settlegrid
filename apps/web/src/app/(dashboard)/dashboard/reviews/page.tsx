'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface Review {
  id: string
  toolId: string
  toolName: string
  toolSlug: string
  rating: number
  comment: string | null
  consumerName: string
  developerResponse: string | null
  developerRespondedAt: string | null
  reportedAt: string | null
  createdAt: string
}

interface Tool {
  id: string
  name: string
  slug: string
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay > 30) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (diffDay > 0) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  if (diffHr > 0) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffMin > 0) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  return 'Just now'
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [toolFilter, setToolFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [respondedFilter, setRespondedFilter] = useState('')

  // Inline response editing
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReviews = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (toolFilter) params.set('toolId', toolFilter)
      if (ratingFilter) params.set('rating', ratingFilter)
      if (respondedFilter) params.set('responded', respondedFilter)
      const qs = params.toString()
      const res = await fetch(`/api/dashboard/developer/reviews${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        setError('Failed to load reviews')
        return
      }
      const json = await res.json()
      setReviews(json.reviews ?? [])
    } catch {
      setError('Network error loading reviews')
    }
  }, [toolFilter, ratingFilter, respondedFilter])

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      if (res.ok) {
        const json = await res.json()
        setTools((json.tools ?? []).filter((t: Tool & { status: string }) => t.status === 'active'))
      }
    } catch {
      // silently handle
    }
  }

  useEffect(() => {
    async function init() {
      await Promise.all([fetchReviews(), fetchTools()])
      setLoading(false)
    }
    init()
  }, [fetchReviews])

  // Re-fetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchReviews()
    }
  }, [toolFilter, ratingFilter, respondedFilter, fetchReviews, loading])

  async function handleSubmitResponse(reviewId: string) {
    if (!responseText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/dashboard/developer/reviews/${reviewId}/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText.trim() }),
      })
      if (res.ok) {
        setRespondingTo(null)
        setResponseText('')
        await fetchReviews()
      }
    } catch {
      // silently handle
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteResponse(reviewId: string) {
    try {
      const res = await fetch(`/api/dashboard/developer/reviews/${reviewId}/respond`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchReviews()
      }
    } catch {
      // silently handle
    }
  }

  async function handleFlag(reviewId: string) {
    try {
      const res = await fetch(`/api/dashboard/developer/reviews/${reviewId}/flag`, {
        method: 'POST',
      })
      if (res.ok) {
        await fetchReviews()
      }
    } catch {
      // silently handle
    }
  }

  function startResponding(review: Review) {
    setRespondingTo(review.id)
    setResponseText(review.developerResponse ?? '')
  }

  // Computed stats
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0
  const respondedCount = reviews.filter((r) => r.developerResponse).length
  const responseRate = totalReviews > 0 ? Math.round((respondedCount / totalReviews) * 100) : 0
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reviews' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reviews</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage reviews across all your tools. Respond to feedback and flag inappropriate reviews.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Reviews</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalReviews}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Rating</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {avgRating > 0 ? avgRating.toFixed(1) : '--'}
              </p>
              {avgRating > 0 && (
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Response Rate</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{responseRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {ratingDistribution.map(({ star, count }) => {
                const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-gray-500 dark:text-gray-400 text-right">{star}</span>
                    <svg className="w-3 h-3 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-gray-400 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="tool-filter" className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Tool</label>
              <select
                id="tool-filter"
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] text-gray-900 dark:text-gray-100 px-3 py-1.5"
              >
                <option value="">All Tools</option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rating-filter" className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Rating</label>
              <select
                id="rating-filter"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] text-gray-900 dark:text-gray-100 px-3 py-1.5"
              >
                <option value="">All Ratings</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="responded-filter" className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Response Status</label>
              <select
                id="responded-filter"
                value={respondedFilter}
                onChange={(e) => setRespondedFilter(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] text-gray-900 dark:text-gray-100 px-3 py-1.5"
              >
                <option value="">All</option>
                <option value="false">Unresponded</option>
                <option value="true">Responded</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review list */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#161822] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No reviews yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Reviews appear here when consumers rate your tools. Share your tool links to get more usage and reviews.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Consumer avatar */}
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-brand">
                        {review.consumerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {review.consumerName}
                        </span>
                        <span className="text-xs text-gray-400">on</span>
                        <Link
                          href={`/tools/${review.toolSlug}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          {review.toolName}
                        </Link>
                        <span className="text-xs text-gray-400">{relativeTime(review.createdAt)}</span>
                        {review.reportedAt && (
                          <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                            Flagged
                          </span>
                        )}
                      </div>
                      <StarRating rating={review.rating} />
                      {review.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                          {review.comment}
                        </p>
                      )}

                      {/* Developer response */}
                      {review.developerResponse && respondingTo !== review.id && (
                        <div className="mt-4 ml-2 pl-4 border-l-2 border-brand/40 bg-brand/5 dark:bg-brand/10 rounded-r-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand mb-1">Your Response</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {review.developerResponse}
                          </p>
                          {review.developerRespondedAt && (
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              {relativeTime(review.developerRespondedAt)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inline response form */}
                      {respondingTo === review.id && (
                        <div className="mt-4 space-y-2">
                          <textarea
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Write your response..."
                            className="w-full text-sm rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={submitting || !responseText.trim()}
                              onClick={() => handleSubmitResponse(review.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
                            >
                              {submitting ? 'Saving...' : 'Submit Response'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRespondingTo(null); setResponseText('') }}
                              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              Cancel
                            </button>
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {responseText.length}/1000
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {respondingTo !== review.id && (
                      <button
                        type="button"
                        onClick={() => startResponding(review)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-[#2A2D3E] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252836] transition-colors"
                      >
                        {review.developerResponse ? 'Edit' : 'Respond'}
                      </button>
                    )}
                    {review.developerResponse && respondingTo !== review.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteResponse(review.id)}
                        className="px-2 py-1.5 text-xs font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remove response"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                    {!review.reportedAt && (
                      <button
                        type="button"
                        onClick={() => handleFlag(review.id)}
                        className="px-2 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Flag review"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
