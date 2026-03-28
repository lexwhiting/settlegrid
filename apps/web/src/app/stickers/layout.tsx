import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Free Stickers | SettleGrid',
  description:
    'Request a free SettleGrid sticker pack for your laptop. Four designs celebrating developer billing infrastructure.',
  alternates: { canonical: 'https://settlegrid.ai/stickers' },
  openGraph: {
    title: 'Get Free SettleGrid Stickers',
    description: 'Request a free sticker pack for your laptop. Four designs for developers.',
    type: 'website',
    url: 'https://settlegrid.ai/stickers',
  },
  twitter: {
    card: 'summary',
    title: 'Get Free SettleGrid Stickers',
    description: 'Request a free sticker pack for your laptop.',
  },
}

export default function StickersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
