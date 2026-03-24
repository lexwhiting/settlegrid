/**
 * settlegrid-shopify — Shopify Storefront MCP Server
 *
 * Wraps the Shopify Storefront API with SettleGrid billing.
 * Requires SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN.
 *
 * Methods:
 *   search_products(query)                (2¢)
 *   get_product(handle)                   (1¢)
 *   get_collections()                     (1¢)
 *   get_shop_info()                       (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; first?: number }
interface GetProductInput { handle: string }

const USER_AGENT = "settlegrid-shopify/1.0 (contact@settlegrid.ai)"

function getConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN
  if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN environment variable is required")
  if (!token) throw new Error("SHOPIFY_STOREFRONT_TOKEN environment variable is required")
  return { domain, token }
}

async function graphqlFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { domain, token } = getConfig()
  const res = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Shopify API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) throw new Error(`Shopify GraphQL: ${json.errors[0].message}`)
  return json.data as T
}

const sg = settlegrid.init({
  toolSlug: "shopify",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 2, displayName: "Search store products" },
      get_product: { costCents: 1, displayName: "Get product by handle" },
      get_collections: { costCents: 1, displayName: "List product collections" },
      get_shop_info: { costCents: 1, displayName: "Get shop information" },
    },
  },
})

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const first = args.first ?? 10
  return graphqlFetch<Record<string, unknown>>(`
    query($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges { node { id title handle description priceRange { minVariantPrice { amount currencyCode } } } }
      }
    }
  `, { query: args.query, first })
}, { method: "search_products" })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.handle || typeof args.handle !== "string") throw new Error("handle is required")
  return graphqlFetch<Record<string, unknown>>(`
    query($handle: String!) {
      productByHandle(handle: $handle) {
        id title handle description tags vendor productType
        priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
        variants(first: 10) { edges { node { id title price { amount currencyCode } availableForSale } } }
      }
    }
  `, { handle: args.handle })
}, { method: "get_product" })

const getCollections = sg.wrap(async () => {
  return graphqlFetch<Record<string, unknown>>(`
    query { collections(first: 20) { edges { node { id title handle description } } } }
  `)
}, { method: "get_collections" })

const getShopInfo = sg.wrap(async () => {
  return graphqlFetch<Record<string, unknown>>(`
    query { shop { name description primaryDomain { url } } }
  `)
}, { method: "get_shop_info" })

export { searchProducts, getProduct, getCollections, getShopInfo }

console.log("settlegrid-shopify MCP server ready")
console.log("Methods: search_products, get_product, get_collections, get_shop_info")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
