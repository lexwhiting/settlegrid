/**
 * settlegrid-learning-paths — Learning Path Generator MCP Server
 *
 * Generates structured learning paths for various tech skills with
 * resource recommendations and milestone tracking.
 *
 * Methods:
 *   get_path(skill)               — Get learning path               (1c)
 *   list_skills()                 — List available skill paths      (1c)
 *   estimate_time(skill, level?)  — Estimate learning time          (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetPathInput { skill: string; current_level?: string }

const PATHS: Record<string, { description: string; prerequisites: string[]; stages: Array<{ level: string; topics: string[]; hours: number; resources: string[] }> }> = {
  javascript: { description: 'Modern JavaScript development', prerequisites: ['HTML basics', 'CSS basics'], stages: [
    { level: 'beginner', topics: ['Variables & types', 'Functions', 'DOM manipulation', 'Events', 'Arrays & objects'], hours: 40, resources: ['MDN Web Docs', 'freeCodeCamp'] },
    { level: 'intermediate', topics: ['Closures', 'Promises & async/await', 'ES6+ features', 'Error handling', 'Modules'], hours: 60, resources: ['JavaScript.info', 'Eloquent JavaScript'] },
    { level: 'advanced', topics: ['Design patterns', 'Performance optimization', 'TypeScript', 'Testing', 'Build tools'], hours: 80, resources: ['Patterns.dev', 'Testing JavaScript'] },
  ]},
  python: { description: 'Python programming', prerequisites: ['Basic math'], stages: [
    { level: 'beginner', topics: ['Syntax', 'Data types', 'Control flow', 'Functions', 'File I/O'], hours: 30, resources: ['Python.org tutorial', 'Automate the Boring Stuff'] },
    { level: 'intermediate', topics: ['OOP', 'Decorators', 'Generators', 'Error handling', 'Virtual environments'], hours: 50, resources: ['Real Python', 'Python Cookbook'] },
    { level: 'advanced', topics: ['Metaclasses', 'Concurrency', 'C extensions', 'Packaging', 'Type hints'], hours: 70, resources: ['Fluent Python', 'CPython Internals'] },
  ]},
  react: { description: 'React frontend development', prerequisites: ['JavaScript intermediate', 'HTML/CSS'], stages: [
    { level: 'beginner', topics: ['JSX', 'Components', 'Props', 'State', 'Event handling'], hours: 30, resources: ['React docs', 'freeCodeCamp'] },
    { level: 'intermediate', topics: ['Hooks', 'Context API', 'React Router', 'Forms', 'API integration'], hours: 50, resources: ['Epic React', 'React patterns'] },
    { level: 'advanced', topics: ['Performance', 'Server components', 'Testing', 'State management', 'SSR/SSG'], hours: 70, resources: ['Next.js docs', 'Testing Library'] },
  ]},
  sql: { description: 'SQL and relational databases', prerequisites: ['None'], stages: [
    { level: 'beginner', topics: ['SELECT', 'WHERE', 'JOIN types', 'GROUP BY', 'INSERT/UPDATE/DELETE'], hours: 20, resources: ['SQLBolt', 'W3Schools SQL'] },
    { level: 'intermediate', topics: ['Subqueries', 'Window functions', 'Indexing', 'Transactions', 'Normalization'], hours: 40, resources: ['Mode Analytics SQL', 'Use the Index, Luke'] },
    { level: 'advanced', topics: ['Query optimization', 'Partitioning', 'Replication', 'Stored procedures', 'Database design'], hours: 60, resources: ['High Performance MySQL', 'PostgreSQL docs'] },
  ]},
}

const sg = settlegrid.init({
  toolSlug: 'learning-paths',
  pricing: { defaultCostCents: 1, methods: {
    get_path: { costCents: 1, displayName: 'Get Learning Path' },
    list_skills: { costCents: 1, displayName: 'List Skills' },
    estimate_time: { costCents: 1, displayName: 'Estimate Time' },
  }},
})

const getPath = sg.wrap(async (args: GetPathInput) => {
  if (!args.skill) throw new Error('skill required')
  const path = PATHS[args.skill.toLowerCase()]
  if (!path) throw new Error(`Unknown skill. Available: ${Object.keys(PATHS).join(', ')}`)
  const stages = args.current_level ? path.stages.filter(s => {
    const levels = ['beginner', 'intermediate', 'advanced']
    return levels.indexOf(s.level) >= levels.indexOf(args.current_level!)
  }) : path.stages
  return { skill: args.skill, ...path, stages, total_hours: stages.reduce((s, st) => s + st.hours, 0) }
}, { method: 'get_path' })

const listSkills = sg.wrap(async (_a: Record<string, never>) => {
  return { skills: Object.entries(PATHS).map(([name, p]) => ({ name, description: p.description, total_hours: p.stages.reduce((s, st) => s + st.hours, 0) })), count: Object.keys(PATHS).length }
}, { method: 'list_skills' })

const estimateTime = sg.wrap(async (args: GetPathInput) => {
  if (!args.skill) throw new Error('skill required')
  const path = PATHS[args.skill.toLowerCase()]
  if (!path) throw new Error(`Unknown skill. Available: ${Object.keys(PATHS).join(', ')}`)
  const hoursPerDay = 2
  const totalHours = path.stages.reduce((s, st) => s + st.hours, 0)
  return { skill: args.skill, total_hours: totalHours, at_2h_per_day: { days: Math.ceil(totalHours / hoursPerDay), weeks: Math.ceil(totalHours / (hoursPerDay * 5)), months: Math.ceil(totalHours / (hoursPerDay * 22)) } }
}, { method: 'estimate_time' })

export { getPath, listSkills, estimateTime }
console.log('settlegrid-learning-paths MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
