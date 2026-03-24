import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "ci-status", pricing: { defaultCostCents: 2, methods: {
  get_github_status: { costCents: 2, displayName: "Get GitHub Actions Status" },
  get_service_status: { costCents: 2, displayName: "Get CI Service Status" },
}}})
const getGithubStatus = sg.wrap(async (args: { owner: string; repo: string }) => {
  if (!args.owner || !args.repo) throw new Error("owner and repo are required")
  const res = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}/actions/runs?per_page=5`, { headers: { Accept: "application/vnd.github.v3+json" } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = await res.json()
  return { repo: `${args.owner}/${args.repo}`, runs: (data.workflow_runs ?? []).map((r: any) => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, branch: r.head_branch, created_at: r.created_at, updated_at: r.updated_at })) }
}, { method: "get_github_status" })
const getServiceStatus = sg.wrap(async (args: { service: string }) => {
  if (!args.service) throw new Error("service is required (github, vercel, netlify, circleci)")
  const statusPages: Record<string, string> = {
    github: "https://www.githubstatus.com/api/v2/status.json",
    vercel: "https://www.vercel-status.com/api/v2/status.json",
    netlify: "https://www.netlifystatus.com/api/v2/status.json",
    circleci: "https://status.circleci.com/api/v2/status.json",
  }
  const url = statusPages[args.service.toLowerCase()]
  if (!url) throw new Error(`Unknown. Available: ${Object.keys(statusPages).join(", ")}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Status page ${res.status}`)
  const data = await res.json()
  return { service: args.service, status: data.status?.indicator, description: data.status?.description, updated_at: data.page?.updated_at }
}, { method: "get_service_status" })
export { getGithubStatus, getServiceStatus }
console.log("settlegrid-ci-status MCP server ready | 2c/call | Powered by SettleGrid")
