import { StaggerContainer } from '@/components/ui/stagger-container'

const withoutItems = [
  'Build a billing system',
  'List on 10 directories',
  'Implement 5 payment protocols',
  'Set up Stripe Connect',
  'Build a marketing page',
  'Monitor uptime',
  'Handle fraud',
  'Track analytics',
]

export function PlatformProblem() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            The Problem
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            You build AI tools. You shouldn&apos;t also build everything else.
          </h2>
        </div>

        <StaggerContainer className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Without */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
            <h3 className="text-lg font-medium text-muted-foreground">
              Without SettleGrid
            </h3>
            <ul className="flex flex-col gap-2.5">
              {withoutItems.map((item) => (
                <li
                  key={item}
                  className="text-sm text-muted-foreground flex items-center gap-3"
                >
                  <span className="text-muted-foreground/50">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* With */}
          <div className="rounded-lg border border-[#E5A336]/20 bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-[#E5A336]/40 hover:-translate-y-0.5">
            <h3 className="text-lg font-medium text-foreground">
              With SettleGrid
            </h3>
            <p className="text-2xl sm:text-3xl font-medium text-foreground leading-snug">
              Wrap one function.
              <br />
              <span className="text-muted-foreground">We handle the rest.</span>
            </p>
          </div>
        </StaggerContainer>
      </div>
    </section>
  )
}
