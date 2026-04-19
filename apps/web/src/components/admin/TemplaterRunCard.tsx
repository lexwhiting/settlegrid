import type { TemplaterRunSnapshot } from '@/lib/templater-runs'

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function TemplaterRunCard({ run }: { run: TemplaterRunSnapshot }) {
  const isRetry = run.runId.startsWith('retry-')
  const passRate =
    run.totalAttempts > 0 ? (run.passed / run.totalAttempts) * 100 : 0

  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-mono text-gray-300 truncate">{run.runId}</h3>
            {isRetry && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 shrink-0">
                retry
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(run.startedAt)} · {formatDuration(run.durationSeconds)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold text-gray-100 tabular-nums">
            {run.passed}
            <span className="text-sm text-gray-500 font-normal">
              {' / '}
              {run.totalAttempts}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Templates produced ({passRate.toFixed(1)}% pass)
          </p>
        </div>
        <div>
          <p
            className={`text-2xl font-bold tabular-nums ${
              run.rejectRatePct > 50
                ? 'text-red-400'
                : run.rejectRatePct > 20
                  ? 'text-amber-400'
                  : 'text-green-400'
            }`}
          >
            {run.rejectRatePct.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Reject rate</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-100 tabular-nums">
            {formatCost(run.totalCostUsdTracked)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total tracked cost</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-100 tabular-nums">
            {formatCost(run.costPerSuccessfulTemplateUsdTracked)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Cost per template</p>
        </div>
      </div>

      {run.topFailureClusters.length > 0 && (
        <div className="border-t border-[#2A2D3E] pt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Top failure modes
          </p>
          <ul className="space-y-1.5">
            {run.topFailureClusters.slice(0, 5).map((c) => (
              <li
                key={c.verdict}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-300 font-mono text-xs truncate">
                  {c.verdict}
                </span>
                <span className="text-gray-400 font-medium tabular-nums shrink-0 ml-2">
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.costTrackingNote && (
        <p className="text-[10px] text-gray-600 italic mt-4 leading-relaxed">
          {run.costTrackingNote}
        </p>
      )}
    </div>
  )
}
