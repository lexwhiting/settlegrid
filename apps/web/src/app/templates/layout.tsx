import { Suspense } from 'react'

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Suspense>{children}</Suspense>
}
