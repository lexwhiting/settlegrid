/**
 * settlegrid-yoga-api — Yoga API MCP Server
 *
 * Yoga pose database with categories, descriptions, and benefits.
 *
 * Methods:
 *   list_categories()             — List all yoga pose categories  (1¢)
 *   get_category_poses(category_id) — Get yoga poses by category ID  (1¢)
 *   list_poses()                  — List all yoga poses  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListCategoriesInput {

}

interface GetCategoryPosesInput {
  category_id: number
}

interface ListPosesInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://yoga-api-nzy4.onrender.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-yoga-api/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Yoga API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'yoga-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_categories: { costCents: 1, displayName: 'List Categories' },
      get_category_poses: { costCents: 1, displayName: 'Get Category Poses' },
      list_poses: { costCents: 1, displayName: 'List Poses' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCategories = sg.wrap(async (args: ListCategoriesInput) => {

  const data = await apiFetch<any>(`/categories`)
  return {
    id: data.id,
    category_name: data.category_name,
    category_description: data.category_description,
  }
}, { method: 'list_categories' })

const getCategoryPoses = sg.wrap(async (args: GetCategoryPosesInput) => {
  if (typeof args.category_id !== 'number') throw new Error('category_id is required and must be a number')
  const category_id = args.category_id
  const data = await apiFetch<any>(`/categories?id=${category_id}`)
  const items = (data.poses ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        english_name: item.english_name,
        sanskrit_name: item.sanskrit_name,
        pose_description: item.pose_description,
        pose_benefits: item.pose_benefits,
    })),
  }
}, { method: 'get_category_poses' })

const listPoses = sg.wrap(async (args: ListPosesInput) => {

  const data = await apiFetch<any>(`/poses`)
  return {
    id: data.id,
    english_name: data.english_name,
    sanskrit_name: data.sanskrit_name,
    pose_description: data.pose_description,
    pose_benefits: data.pose_benefits,
  }
}, { method: 'list_poses' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCategories, getCategoryPoses, listPoses }

console.log('settlegrid-yoga-api MCP server ready')
console.log('Methods: list_categories, get_category_poses, list_poses')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
