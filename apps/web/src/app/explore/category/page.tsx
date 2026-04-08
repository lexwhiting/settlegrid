import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

// Redirect to /explore. The noindex prevents Google from wasting crawl
// budget on this URL (GSC flagged it as "Page with redirect").
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CategoryIndexPage() {
  redirect('/explore')
}
