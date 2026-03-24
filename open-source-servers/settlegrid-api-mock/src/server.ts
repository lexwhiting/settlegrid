import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "api-mock", pricing: { defaultCostCents: 1, methods: {
  generate_response: { costCents: 1, displayName: "Generate Mock Response" },
  generate_schema: { costCents: 1, displayName: "Generate Mock Schema" },
}}})
const generateResponse = sg.wrap(async (args: { schema: Record<string, string>; count?: number }) => {
  if (!args.schema) throw new Error("schema is required (e.g. { name: 'string', age: 'number' })")
  const count = Math.min(args.count ?? 1, 20)
  const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"]
  const domains = ["example.com", "test.org", "demo.io", "sample.dev"]
  const results = Array.from({ length: count }, (_, i) => {
    const obj: Record<string, any> = {}
    for (const [key, type] of Object.entries(args.schema)) {
      switch (type) {
        case "string": obj[key] = key.includes("name") ? names[i % names.length] : key.includes("email") ? `${names[i % names.length].toLowerCase()}@${domains[i % domains.length]}` : `${key}_${i + 1}`; break
        case "number": obj[key] = Math.floor(Math.random() * 100); break
        case "boolean": obj[key] = Math.random() > 0.5; break
        case "date": obj[key] = new Date(Date.now() - Math.random() * 365 * 86400000).toISOString().slice(0, 10); break
        case "uuid": obj[key] = crypto.randomUUID(); break
        default: obj[key] = `${type}_value`
      }
    }
    return obj
  })
  return { count: results.length, data: results }
}, { method: "generate_response" })
const generateSchema = sg.wrap(async (args: { resource: string; fields?: string[] }) => {
  if (!args.resource) throw new Error("resource is required")
  const presets: Record<string, Record<string, string>> = {
    user: { id: "uuid", name: "string", email: "string", created_at: "date", active: "boolean" },
    product: { id: "uuid", name: "string", price: "number", in_stock: "boolean", created_at: "date" },
    order: { id: "uuid", user_id: "uuid", total: "number", status: "string", created_at: "date" },
    post: { id: "uuid", title: "string", body: "string", author: "string", published: "boolean" },
  }
  const schema = presets[args.resource.toLowerCase()]
  if (!schema) throw new Error(`Unknown preset. Available: ${Object.keys(presets).join(", ")}`)
  return { resource: args.resource, schema }
}, { method: "generate_schema" })
export { generateResponse, generateSchema }
console.log("settlegrid-api-mock MCP server ready | 1c/call | Powered by SettleGrid")
