import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "changelog-gen", pricing: { defaultCostCents: 1, methods: {
  generate: { costCents: 1, displayName: "Generate Changelog" },
  parse_commit: { costCents: 1, displayName: "Parse Conventional Commit" },
}}})
const generate = sg.wrap(async (args: { commits: string[]; version: string }) => {
  if (!args.commits || !args.version) throw new Error("commits array and version required")
  const categories: Record<string, string[]> = { features: [], fixes: [], breaking: [], docs: [], chores: [], refactors: [], tests: [] }
  for (const c of args.commits) {
    if (c.startsWith("feat")) categories.features.push(c.replace(/^feat(\(.*?\))?:\s*/, ""))
    else if (c.startsWith("fix")) categories.fixes.push(c.replace(/^fix(\(.*?\))?:\s*/, ""))
    else if (c.includes("BREAKING")) categories.breaking.push(c)
    else if (c.startsWith("docs")) categories.docs.push(c.replace(/^docs(\(.*?\))?:\s*/, ""))
    else if (c.startsWith("chore")) categories.chores.push(c.replace(/^chore(\(.*?\))?:\s*/, ""))
    else if (c.startsWith("refactor")) categories.refactors.push(c.replace(/^refactor(\(.*?\))?:\s*/, ""))
    else if (c.startsWith("test")) categories.tests.push(c.replace(/^test(\(.*?\))?:\s*/, ""))
  }
  const date = new Date().toISOString().slice(0, 10)
  let md = `## [${args.version}] - ${date}\n\n`
  if (categories.breaking.length) md += `### BREAKING CHANGES\n${categories.breaking.map(c => `- ${c}`).join("\n")}\n\n`
  if (categories.features.length) md += `### Features\n${categories.features.map(c => `- ${c}`).join("\n")}\n\n`
  if (categories.fixes.length) md += `### Bug Fixes\n${categories.fixes.map(c => `- ${c}`).join("\n")}\n\n`
  return { version: args.version, date, markdown: md.trim(), stats: { features: categories.features.length, fixes: categories.fixes.length, breaking: categories.breaking.length, total: args.commits.length } }
}, { method: "generate" })
const parseCommit = sg.wrap(async (args: { message: string }) => {
  if (!args.message) throw new Error("message is required")
  const regex = /^(\w+)(\((.+?)\))?(!)?:\s*(.+)$/
  const match = regex.exec(args.message)
  if (!match) return { valid: false, message: args.message, error: "Not a conventional commit" }
  return { valid: true, type: match[1], scope: match[3] ?? null, breaking: !!match[4], description: match[5] }
}, { method: "parse_commit" })
export { generate, parseCommit }
console.log("settlegrid-changelog-gen MCP server ready | 1c/call | Powered by SettleGrid")
