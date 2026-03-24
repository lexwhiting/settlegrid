export type Category =
  | 'data'
  | 'nlp'
  | 'search'
  | 'finance'
  | 'code'
  | 'security'
  | 'analytics'
  | 'other'

export type PricingModel = 'per-call' | 'per-token' | 'per-byte'

export type Template = 'blank' | 'rest-api' | 'openapi' | 'mcp-server'

export type DeployTarget = 'vercel' | 'railway' | 'docker' | 'none'

export interface ToolConfig {
  directory: string
  toolName: string
  toolSlug: string
  description: string
  category: Category
  pricingModel: PricingModel
  priceCents: number
  template: Template
  deployTarget: DeployTarget
  targetDir: string
}
