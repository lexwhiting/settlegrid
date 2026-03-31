import { AnimatedCounter } from "@/components/ui/animated-counter"

const stats = [
  { value: "15", label: "Payment protocols" },
  { value: "< 50ms", label: "Metering latency" },
  { value: "95–100%", label: "Revenue share" },
  { value: "Free forever", label: "50K ops/month" },
]

export function StatsBar() {
  return (
    <section className="py-16 lg:py-20">
      <div className="w-full max-w-5xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-10 sm:gap-0">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center">
              <div className="flex flex-col items-center text-center px-6 lg:px-10">
                <AnimatedCounter
                  value={stat.value}
                  className="text-2xl lg:text-3xl font-medium text-foreground"
                />
                <span className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </span>
              </div>
              {index < stats.length - 1 && (
                <div className="hidden sm:block w-px h-12 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
