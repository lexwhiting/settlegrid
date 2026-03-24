import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "code-coverage", pricing: { defaultCostCents: 1, methods: {
  analyze_coverage: { costCents: 1, displayName: "Analyze Coverage Report" },
  get_badge: { costCents: 1, displayName: "Get Coverage Badge" },
}}})
const analyzeCoverage = sg.wrap(async (args: { total_lines: number; covered_lines: number; total_branches?: number; covered_branches?: number; total_functions?: number; covered_functions?: number }) => {
  if (!args.total_lines || args.total_lines < 1) throw new Error("total_lines > 0 required")
  if (args.covered_lines < 0 || args.covered_lines > args.total_lines) throw new Error("covered_lines must be 0 to total_lines")
  const linePct = (args.covered_lines / args.total_lines * 100)
  const branchPct = args.total_branches ? (args.covered_branches ?? 0) / args.total_branches * 100 : null
  const funcPct = args.total_functions ? (args.covered_functions ?? 0) / args.total_functions * 100 : null
  const rating = linePct >= 80 ? "good" : linePct >= 60 ? "acceptable" : linePct >= 40 ? "needs improvement" : "poor"
  return { line_coverage_pct: Math.round(linePct * 10) / 10, branch_coverage_pct: branchPct ? Math.round(branchPct * 10) / 10 : null, function_coverage_pct: funcPct ? Math.round(funcPct * 10) / 10 : null, uncovered_lines: args.total_lines - args.covered_lines, rating, meets_threshold_80: linePct >= 80 }
}, { method: "analyze_coverage" })
const getBadge = sg.wrap(async (args: { coverage_pct: number }) => {
  if (args.coverage_pct === undefined) throw new Error("coverage_pct is required")
  const pct = Math.round(args.coverage_pct)
  const color = pct >= 80 ? "brightgreen" : pct >= 60 ? "yellow" : pct >= 40 ? "orange" : "red"
  return { badge_url: `https://img.shields.io/badge/coverage-${pct}%25-${color}`, coverage_pct: pct, color }
}, { method: "get_badge" })
export { analyzeCoverage, getBadge }
console.log("settlegrid-code-coverage MCP server ready | 1c/call | Powered by SettleGrid")
