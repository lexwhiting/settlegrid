const useCases = [
  {
    title: "MCP Server Developers",
    description:
      "Wrap your MCP tools and earn per-call revenue from AI agents. Zero infrastructure changes.",
  },
  {
    title: "AI Model Creators",
    description:
      "Charge per-inference for models on HuggingFace, Replicate, or your own endpoint.",
  },
  {
    title: "API Builders",
    description:
      "Add metered billing to any REST API. Agents discover and pay automatically.",
  },
  {
    title: "Agent Framework Authors",
    description:
      "LangChain, CrewAI, AutoGen — tools across any framework, one settlement layer.",
  },
]

export function UseCases() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Built for
          </p>
          <p className="text-lg text-foreground max-w-xl">
            Any developer monetizing AI capabilities.
          </p>
        </div>

        {/* Use cases grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-3"
            >
              <h3 className="text-lg font-medium text-foreground">
                {useCase.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
