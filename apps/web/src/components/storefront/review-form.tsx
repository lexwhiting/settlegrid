'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ReviewFormProps {
  toolSlug: string
}

export function ReviewForm({ toolSlug }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submittedRating, setSubmittedRating] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1 || rating > 5) {
      setError('Please select a rating.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/tools/by-slug/${toolSlug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401) {
          setError('Sign in to review.')
        } else if (res.status === 409) {
          setError('Already reviewed.')
        } else if (res.status === 403) {
          setError('Use the tool first.')
        } else if (data.code === 'CONTENT_POLICY_VIOLATION') {
          setError('Your review violates our content policy. Please remove any profanity, personal information, or spam and try again.')
        } else {
          setError(data.error || 'Failed to submit review.')
        }
        return
      }
      setSubmittedRating(rating)
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mt-8 border-t border-gray-100 dark:border-[#252836] pt-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Thanks for your review!</span>
          <div className="flex items-center gap-0.5" aria-label={`${submittedRating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-4 h-4 ${star <= submittedRating ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-[#252836] pt-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Write a Review</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star rating selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Rating</label>
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHoveredStar(0)}
            role="radiogroup"
            aria-label="Rating"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                className="focus:outline-none focus:ring-2 focus:ring-brand rounded-sm p-0.5 transition-transform hover:scale-110"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              >
                <svg
                  className={`w-6 h-6 transition-colors ${
                    star <= (hoveredStar || rating)
                      ? 'text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Comment textarea */}
        <div>
          <label htmlFor="review-comment" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Share your experience with this tool..."
            className="w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#252836] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand focus:outline-none resize-none"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{comment.length}/1000</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || rating === 0}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            By submitting, you agree to our{' '}
            <Link href="/review-policy" className="text-brand hover:underline">
              Review Policy
            </Link>.
          </p>
        </div>
      </form>
    </div>
  )
}
