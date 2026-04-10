import { StaggerContainer } from '@/components/ui/stagger-container'

const protocols = [
  'MCP',
  'MPP',
  'x402',
  'AP2',
  'Visa TAP',
  'UCP',
  'ACP',
  'Mastercard Verifiable Intent',
  'Circle Nano',
  'REST',
  'L402',
  'Alipay Trust',
  'KYAPay',
  'EMVCo',
  'DRAIN',
]

export function PlatformAgents() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Agent-Native
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            Built for agents, not just humans
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mt-2">
            15 payment protocols. One integration.
          </p>
        </div>

        <StaggerContainer>
          {/* Protocol pills */}
          <div className="flex flex-wrap gap-3 mb-12">
            {protocols.map((protocol) => (
              <span
                key={protocol}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-full transition-colors duration-200 hover:border-muted-foreground/50 hover:text-foreground"
              >
                {protocol}
              </span>
            ))}
          </div>

          {/* Explanation */}
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            MCP, x402, AP2, MPP, Visa TAP, and 10 more. Your tool is reachable
            by any AI agent regardless of which payment protocol it speaks.
          </p>
        </StaggerContainer>
      </div>
    </section>
  )
}
