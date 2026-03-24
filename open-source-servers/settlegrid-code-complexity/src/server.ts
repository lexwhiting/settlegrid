import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "code-complexity", pricing: { defaultCostCents: 1, methods: {
  analyze: { costCents: 1, displayName: "Analyze Complexity" },
  explain_metric: { costCents: 1, displayName: "Explain Metric" },
}}})
const analyze = sg.wrap(async (args: { code: string; language?: string }) => {
  if (!args.code) throw new Error("code is required")
  const lines = args.code.split("\n")
  const loc = lines.length
  const blankLines = lines.filter(l => l.trim() === "").length
  const commentLines = lines.filter(l => l.trim().startsWith("//") || l.trim().startsWith("#") || l.trim().startsWith("*")).length
  const ifCount = (args.code.match(/\b(if|else if|elif|case|catch)\b/g) ?? []).length
  const loopCount = (args.code.match(/\b(for|while|do)\b/g) ?? []).length
  const funcCount = (args.code.match(/\b(function|def|fn|func|=>)\b/g) ?? []).length
  const cyclomatic = 1 + ifCount + loopCount
  const maxNesting = Math.min(5, Math.max(...lines.map(l => (l.match(/^(\s+)/)?.[1]?.length ?? 0) / 2)))
  return { loc, blank_lines: blankLines, comment_lines: commentLines, code_lines: loc - blankLines - commentLines, cyclomatic_complexity: cyclomatic, functions: funcCount, branches: ifCount, loops: loopCount, max_nesting_depth: Math.round(maxNesting), language: args.language ?? "unknown", rating: cyclomatic <= 5 ? "simple" : cyclomatic <= 10 ? "moderate" : cyclomatic <= 20 ? "complex" : "very complex" }
}, { method: "analyze" })
const metrics: Record<string, { description: string; good_range: string; formula: string }> = {
  cyclomatic: { description: "Number of independent paths through code", good_range: "1-10", formula: "1 + number of branches" },
  cognitive: { description: "How hard code is to understand", good_range: "1-15", formula: "Weighted sum of nesting, breaks in flow" },
  halstead: { description: "Computational complexity from operators/operands", good_range: "N/A", formula: "Based on unique operators and operands" },
  maintainability: { description: "How easy code is to maintain", good_range: "20-100 (higher=better)", formula: "171 - 5.2*ln(Halstead) - 0.23*CC - 16.2*ln(LOC)" },
  loc: { description: "Lines of code", good_range: "<300 per function", formula: "Count of non-blank lines" },
}
const explainMetric = sg.wrap(async (args: { metric: string }) => {
  if (!args.metric) throw new Error("metric is required")
  const m = metrics[args.metric.toLowerCase()]
  if (!m) throw new Error(`Unknown. Available: ${Object.keys(metrics).join(", ")}`)
  return { metric: args.metric, ...m }
}, { method: "explain_metric" })
export { analyze, explainMetric }
console.log("settlegrid-code-complexity MCP server ready | 1c/call | Powered by SettleGrid")
