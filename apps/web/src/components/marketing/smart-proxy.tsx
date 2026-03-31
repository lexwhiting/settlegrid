import { CopyButton } from "@/components/ui/copy-button"

const proxyCode = `curl https://settlegrid.ai/api/proxy/my-tool \\
  -H "Authorization: Bearer sg_live_..."`

const features = [
  "Per-call metering & budget enforcement",
  "15-protocol payment detection",
  "IP allowlisting & fraud signals",
  "Automatic Stripe payouts",
]

export function SmartProxy() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left side - Text */}
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Smart Proxy
            </p>
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground text-balance">
              One URL. Billing built in.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
              Point any AI agent at your proxy endpoint. SettleGrid handles
              authentication, metering, rate limiting, budget enforcement, and
              fraud detection — transparently, in under 50ms.
            </p>
            <ul className="flex flex-col gap-2 mt-2">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="text-sm text-muted-foreground flex items-center gap-3"
                >
                  <span className="text-muted-foreground">—</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Right side - Terminal */}
          <div className="w-full">
            <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_-12px_rgba(229,163,54,0.15)]">
              {/* Terminal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-2">
                    terminal
                  </span>
                </div>
                <CopyButton text={proxyCode} />
              </div>

              {/* Terminal content */}
              <div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
                {/* curl command */}
                <div className="text-muted-foreground mb-1">
                  <span className="text-[#28c840]">$</span>
                  <span> curl https://settlegrid.ai/api/proxy/my-tool \</span>
                </div>
                <div className="text-muted-foreground mb-6 pl-4">
                  <span>-H </span>
                  <span className="text-[#98c379]">
                    {`"Authorization: Bearer sg_live_..."`}
                  </span>
                </div>

                {/* JSON response */}
                <div className="space-y-0.5">
                  <div className="text-foreground">{"{"}</div>
                  <div className="pl-4">
                    <span className="text-[#e06c75]">{`"result"`}</span>
                    <span className="text-foreground">: </span>
                    <span className="text-[#98c379]">{`"..."`}</span>
                    <span className="text-foreground">,</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[#e06c75]">{`"_settlegrid"`}</span>
                    <span className="text-foreground">{`: {`}</span>
                  </div>
                  <div className="pl-8">
                    <span className="text-[#e06c75]">{`"costCents"`}</span>
                    <span className="text-foreground">: </span>
                    <span className="text-[#d19a66]">5</span>
                    <span className="text-foreground">,</span>
                  </div>
                  <div className="pl-8">
                    <span className="text-[#e06c75]">{`"remainingBalance"`}</span>
                    <span className="text-foreground">: </span>
                    <span className="text-[#d19a66]">995</span>
                  </div>
                  <div className="pl-4 text-foreground">{"}"}</div>
                  <div className="text-foreground">{"}"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
