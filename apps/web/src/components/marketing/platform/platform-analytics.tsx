import { StaggerContainer } from '@/components/ui/stagger-container'

const analyticsFeatures = [
  {
    title: 'Category Benchmarking',
    description:
      'See how your pricing and usage compare to category averages. Know if you are priced too high, too low, or just right.',
  },
  {
    title: 'Consumer Insights',
    description:
      'Know who is using your tool, who is churning, and estimated LTV. Understand your audience without building analytics from scratch.',
  },
  {
    title: 'Anomaly Detection',
    description:
      'Get alerted when traffic spikes or drops unexpectedly. Catch issues before they become outages.',
  },
]

export function PlatformAnalytics() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Analytics
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            Know what&apos;s working
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mt-2">
            Category benchmarking, consumer insights, and anomaly detection — built in.
          </p>
        </div>

        <StaggerContainer className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {analyticsFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5"
            >
              <h3 className="text-lg font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
