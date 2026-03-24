import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "openapi-validate", pricing: { defaultCostCents: 2, methods: {
  validate: { costCents: 2, displayName: "Validate OpenAPI Spec" },
  summarize: { costCents: 2, displayName: "Summarize API" },
}}})
const validate = sg.wrap(async (args: { spec: any }) => {
  if (!args.spec) throw new Error("spec (OpenAPI JSON) is required")
  const errors: string[] = []
  const warnings: string[] = []
  if (!args.spec.openapi && !args.spec.swagger) errors.push("Missing openapi/swagger version field")
  if (!args.spec.info) errors.push("Missing info object")
  else { if (!args.spec.info.title) errors.push("Missing info.title"); if (!args.spec.info.version) errors.push("Missing info.version") }
  if (!args.spec.paths) errors.push("Missing paths object")
  else {
    for (const [path, methods] of Object.entries(args.spec.paths as Record<string, any>)) {
      if (!path.startsWith("/")) errors.push(`Path "${path}" must start with /`)
      for (const [method, op] of Object.entries(methods)) {
        if (!["get","post","put","patch","delete","options","head","trace"].includes(method)) continue
        if (!(op as any).responses) warnings.push(`${method.toUpperCase()} ${path}: missing responses`)
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings, error_count: errors.length, warning_count: warnings.length }
}, { method: "validate" })
const summarize = sg.wrap(async (args: { spec: any }) => {
  if (!args.spec?.paths) throw new Error("spec with paths is required")
  const paths = Object.keys(args.spec.paths)
  let endpoints = 0
  const methods: Record<string, number> = {}
  for (const ops of Object.values(args.spec.paths as Record<string, any>)) {
    for (const m of Object.keys(ops)) {
      if (["get","post","put","patch","delete"].includes(m)) { endpoints++; methods[m] = (methods[m] ?? 0) + 1 }
    }
  }
  return { title: args.spec.info?.title, version: args.spec.info?.version, total_paths: paths.length, total_endpoints: endpoints, methods, has_security: !!args.spec.components?.securitySchemes }
}, { method: "summarize" })
export { validate, summarize }
console.log("settlegrid-openapi-validate MCP server ready | 2c/call | Powered by SettleGrid")
