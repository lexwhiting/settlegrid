import Link from "next/link"
import { StaggerContainer } from "@/components/ui/stagger-container"

const channels = [
  {
    title: "Agent-Native Discovery",
    description:
      "AI agents query our API around the clock — searching by category, price, and rating. Your tool shows up in results the moment you publish. No manual listing required.",
  },
  {
    title: "One MCP Connection. Every Tool.",
    description:
      "Any MCP client that connects to a single endpoint can search, browse, and call your tool directly. One connection for agents — the entire marketplace.",
  },
  {
    title: "Recommended by AI Assistants",
    description:
      "Claude, ChatGPT, and Perplexity know how to find your tool and recommend it when users ask for help. Distribution through every AI conversation.",
  },
  {
    title: "50+ SEO Pages. Automatic.",
    description:
      "Category pages, framework integration pages, curated collections, trending — each one ranks in Google and drives organic traffic to your tool page.",
  },
  {
    title: "Your README Becomes a Storefront",
    description:
      "One script tag in your GitHub README. Visitors see a live badge with your price, call count, and a direct link to try your tool.",
  },
  {
    title: "Failover Means You Gain Traffic",
    description:
      "Every tool gets a permanent, cached, failover-backed URL. When competing tools go down, SettleGrid routes their traffic to yours automatically.",
  },
]

export function Distribution() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Distribution
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            You built a great tool. Now 10 channels sell it for you.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mt-2">
            Most platforms stop at listing. SettleGrid actively distributes your
            tool through AI agents, search engines, and developer communities.
          </p>
        </div>

        {/* Distribution channels grid */}
        <StaggerContainer className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {channels.map((channel) => (
            <div
              key={channel.title}
              className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5"
            >
              <h3 className="text-lg font-medium text-foreground">
                {channel.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {channel.description}
              </p>
            </div>
          ))}
        </StaggerContainer>

        {/* Footer link */}
        <div className="flex justify-center">
          <Link
            href="/learn/discovery"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See the full distribution playbook <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
