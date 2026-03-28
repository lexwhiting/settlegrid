import { redirect } from 'next/navigation'

// The category index just redirects to /explore which has the full category grid
export default function CategoryIndexPage() {
  redirect('/explore')
}
