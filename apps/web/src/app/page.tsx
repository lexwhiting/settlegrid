import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Hero } from '@/components/marketing/hero'
import { StatsBar } from '@/components/marketing/stats-bar'
import { Features } from '@/components/marketing/features'
import { SmartProxy } from '@/components/marketing/smart-proxy'
import { Protocols } from '@/components/marketing/protocols'
import { UseCases } from '@/components/marketing/use-cases'
import { Onboarding } from '@/components/marketing/onboarding'
import { PricingSection } from '@/components/marketing/pricing-section'
import { CTASection } from '@/components/marketing/cta-section'
import { Footer } from '@/components/marketing/footer'

export const metadata: Metadata = {
  title: 'SettleGrid — The Settlement Layer for the AI Economy',
  description:
    'The universal settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts for any AI service. 15 protocols. Free forever — 50K ops/month.',
  alternates: { canonical: 'https://settlegrid.ai' },
  keywords: [
    'universal AI settlement',
    'AI service billing',
    'per-call billing',
    'AI agent payments',
    'settlement layer',
    'MCP monetization',
    'API monetization',
    'usage-based billing',
    'AI economy',
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SettleGrid',
  description:
    'The universal settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts for any AI service. 15 protocols. Free forever.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  url: 'https://settlegrid.ai',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free forever — 50,000 operations/month, unlimited tools.',
    },
    {
      '@type': 'Offer',
      name: 'Builder',
      price: '19',
      priceCurrency: 'USD',
      description: '200,000 operations/month, sandbox mode, Slack alerts, benchmarking.',
    },
    {
      '@type': 'Offer',
      name: 'Scale',
      price: '79',
      priceCurrency: 'USD',
      description: '2,000,000 operations/month, team access, advanced analytics, fraud detection.',
    },
  ],
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <StatsBar />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <Features />
      <SmartProxy />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <Protocols />
      <UseCases />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <Onboarding />
      <PricingSection />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <CTASection />
      <Footer />
    </main>
  )
}
