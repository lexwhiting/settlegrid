'use client'

import { StaggerContainer } from '@/components/ui/stagger-container'
import { CopyButton } from '@/components/ui/copy-button'

const discoveryApiResponse = `{
  "tools": [
    {
      "name": "WeatherNow",
      "slug": "weather-now",
      "costCents": 2,
      "averageRating": 4.8,
      "category": "data",
      "url": "https://settlegrid.ai/tools/weather-now"
    }
  ],
  "total": 1,
  "hasMore": false
}`

const mcpConfig = `{
  "mcpServers": {
    "settlegrid": {
      "url": "https://settlegrid.ai/api/mcp"
    }
  }
}`

const badgeMarkdown = `[![SettleGrid](https://settlegrid.ai/api/badge/tool/your-tool)](https://settlegrid.ai/tools/your-tool)`

export function PlatformChannels() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Distribution
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            10 channels. Zero manual listings.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mt-2">
            Every tool you publish is automatically distributed through these
            channels.
          </p>
        </div>

        {/* Channel grid - mixed layout */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* 1. Agent Discovery API (wide) */}
          <StaggerContainer className="md:col-span-2">
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex flex-col gap-3 lg:max-w-md">
                  <span className="text-sm font-mono text-[#E5A336]">01</span>
                  <h3 className="text-lg font-medium text-foreground">
                    Agent Discovery API
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    AI agents query{' '}
                    <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                      GET /api/v1/discover?q=weather&max_cost=5
                    </code>{' '}
                    and find your tool by category, price, and rating. No
                    integration required from you.
                  </p>
                </div>
                <div className="lg:flex-1 lg:max-w-lg">
                  <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_-12px_rgba(229,163,54,0.15)]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono ml-2">
                          response.json
                        </span>
                      </div>
                      <CopyButton text={discoveryApiResponse} />
                    </div>
                    <div className="p-5 font-mono text-xs leading-relaxed overflow-x-auto">
                      <div className="space-y-0.5">
                        <div className="text-foreground">{'{'}</div>
                        <div className="pl-4">
                          <span className="text-[#e06c75]">{'"tools"'}</span>
                          <span className="text-foreground">: [{'{'}</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"name"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#98c379]">{'"WeatherNow"'}</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"slug"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#98c379]">{'"weather-now"'}</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"costCents"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#d19a66]">2</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"averageRating"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#d19a66]">4.8</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"category"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#98c379]">{'"data"'}</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"url"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#98c379]">{'"https://settlegrid.ai/tools/weather-now"'}</span>
                        </div>
                        <div className="pl-4 text-foreground">{'}],'}</div>
                        <div className="pl-4">
                          <span className="text-[#e06c75]">{'"total"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#d19a66]">1</span>
                          <span className="text-foreground">,</span>
                        </div>
                        <div className="pl-4">
                          <span className="text-[#e06c75]">{'"hasMore"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#d19a66]">false</span>
                        </div>
                        <div className="text-foreground">{'}'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaggerContainer>

          {/* 2. Meta-MCP Server (wide) */}
          <StaggerContainer className="md:col-span-2">
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex flex-col gap-3 lg:max-w-md">
                  <span className="text-sm font-mono text-[#E5A336]">02</span>
                  <h3 className="text-lg font-medium text-foreground">
                    Meta-MCP Server
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    One MCP connection gives agents access to every tool in the
                    marketplace. Your tool is callable the moment you publish.
                  </p>
                </div>
                <div className="lg:flex-1 lg:max-w-lg">
                  <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_-12px_rgba(229,163,54,0.15)]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono ml-2">
                          claude_desktop_config.json
                        </span>
                      </div>
                      <CopyButton text={mcpConfig} />
                    </div>
                    <div className="p-5 font-mono text-xs leading-relaxed">
                      <div className="space-y-0.5">
                        <div className="text-foreground">{'{'}</div>
                        <div className="pl-4">
                          <span className="text-[#e06c75]">{'"mcpServers"'}</span>
                          <span className="text-foreground">{': {'}</span>
                        </div>
                        <div className="pl-8">
                          <span className="text-[#e06c75]">{'"settlegrid"'}</span>
                          <span className="text-foreground">{': {'}</span>
                        </div>
                        <div className="pl-12">
                          <span className="text-[#e06c75]">{'"url"'}</span>
                          <span className="text-foreground">: </span>
                          <span className="text-[#98c379]">{'"https://settlegrid.ai/api/mcp"'}</span>
                        </div>
                        <div className="pl-8 text-foreground">{'}'}</div>
                        <div className="pl-4 text-foreground">{'}'}</div>
                        <div className="text-foreground">{'}'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaggerContainer>

          {/* 3. AI Assistant Recommendations */}
          <StaggerContainer staggerDelay={0.1}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">03</span>
              <h3 className="text-lg font-medium text-foreground">
                AI Assistant Recommendations
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Claude, ChatGPT, and Perplexity know how to find your tool. Our
                machine-readable docs instruct AI assistants to recommend tools
                from the SettleGrid marketplace.
              </p>
            </div>
          </StaggerContainer>

          {/* 4. Search Engine Optimization */}
          <StaggerContainer staggerDelay={0.1}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">04</span>
              <h3 className="text-lg font-medium text-foreground">
                Search Engine Optimization
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every tool gets its own page with Product schema, star ratings,
                and FAQ structured data. Category pages, framework pages, and
                curated collections rank in Google and drive organic traffic.
              </p>
            </div>
          </StaggerContainer>

          {/* 5. Embeddable Badges (wide) */}
          <StaggerContainer className="md:col-span-2">
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex flex-col gap-3 lg:max-w-md">
                  <span className="text-sm font-mono text-[#E5A336]">05</span>
                  <h3 className="text-lg font-medium text-foreground">
                    Embeddable Badges
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Add one line to your README. Visitors see a live badge with
                    your price, call count, and a direct link to try your tool.
                  </p>
                </div>
                <div className="lg:flex-1 lg:max-w-lg">
                  <div className="rounded-md bg-background border border-border p-4 font-mono text-xs leading-relaxed relative overflow-x-auto">
                    <CopyButton text={badgeMarkdown} className="absolute top-2 right-2" />
                    <span className="text-muted-foreground break-all">
                      {badgeMarkdown}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </StaggerContainer>

          {/* 6. Smart Proxy */}
          <StaggerContainer staggerDelay={0.15}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">06</span>
              <h3 className="text-lg font-medium text-foreground">
                Smart Proxy
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every tool gets a permanent URL at{' '}
                <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                  settlegrid.ai/api/proxy/your-tool
                </code>
                . Edge-cached responses are faster than calling your API
                directly. 15 payment protocols detected automatically.
              </p>
            </div>
          </StaggerContainer>

          {/* 7. Failover */}
          <StaggerContainer staggerDelay={0.15}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">07</span>
              <h3 className="text-lg font-medium text-foreground">
                Failover
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When a competing tool goes down, SettleGrid routes their traffic
                to yours. Your effective uptime is better than yours alone.
              </p>
            </div>
          </StaggerContainer>

          {/* 8. Framework Integrations */}
          <StaggerContainer staggerDelay={0.2}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">08</span>
              <h3 className="text-lg font-medium text-foreground">
                Framework Integrations
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Native packages for LangChain, n8n, and Cursor. Your tool is
                instantly available to 400K+ n8n users and every LangChain agent.
              </p>
            </div>
          </StaggerContainer>

          {/* 9. Trending & Spotlight */}
          <StaggerContainer staggerDelay={0.2}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">09</span>
              <h3 className="text-lg font-medium text-foreground">
                Trending & Spotlight
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Top tools are featured on the Trending page and as Tool of the
                Week. High-quality tools earn visibility organically through real
                usage data.
              </p>
            </div>
          </StaggerContainer>

          {/* 10. Priority Listing */}
          <StaggerContainer className="md:col-span-2">
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">10</span>
              <h3 className="text-lg font-medium text-foreground">
                Priority Listing
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Builder and Scale tier tools rank higher in marketplace results.
                More visibility without more marketing spend.
              </p>
            </div>
          </StaggerContainer>
        </div>
      </div>
    </section>
  )
}
