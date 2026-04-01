/**
 * settlegrid-course-catalog — Open Course Catalog MCP Server
 *
 * Searches and retrieves open course data from free educational APIs.
 * Provides course listings, subject catalogs, and university information.
 *
 * Methods:
 *   search_courses(query, subject?)   — Search open courses           (2c)
 *   get_subjects()                     — List available subjects       (2c)
 *   get_universities()                 — List universities with OCW    (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; subject?: string; limit?: number }

const SUBJECTS: Record<string, { name: string; course_count: number; description: string }> = {
  cs: { name: 'Computer Science', course_count: 2400, description: 'Programming, algorithms, AI, systems' },
  math: { name: 'Mathematics', course_count: 1800, description: 'Calculus, algebra, statistics, discrete math' },
  physics: { name: 'Physics', course_count: 1200, description: 'Mechanics, quantum, relativity, thermodynamics' },
  biology: { name: 'Biology', course_count: 1100, description: 'Genetics, ecology, cell biology, neuroscience' },
  chemistry: { name: 'Chemistry', course_count: 900, description: 'Organic, inorganic, physical, analytical' },
  economics: { name: 'Economics', course_count: 1500, description: 'Micro, macro, econometrics, development' },
  business: { name: 'Business', course_count: 2000, description: 'Management, finance, marketing, strategy' },
  psychology: { name: 'Psychology', course_count: 800, description: 'Cognitive, clinical, developmental, social' },
  history: { name: 'History', course_count: 700, description: 'World history, art history, political history' },
  engineering: { name: 'Engineering', course_count: 1600, description: 'Mechanical, electrical, civil, chemical' },
}

const UNIVERSITIES = [
  { name: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu', courses: 2500, country: 'US' },
  { name: 'Stanford Online', url: 'https://online.stanford.edu', courses: 800, country: 'US' },
  { name: 'Yale Open Courses', url: 'https://oyc.yale.edu', courses: 42, country: 'US' },
  { name: 'Khan Academy', url: 'https://khanacademy.org', courses: 10000, country: 'US' },
  { name: 'Harvard Online', url: 'https://online-learning.harvard.edu', courses: 900, country: 'US' },
  { name: 'Open University', url: 'https://www.open.edu/openlearn', courses: 1000, country: 'UK' },
  { name: 'TU Delft OCW', url: 'https://ocw.tudelft.nl', courses: 100, country: 'NL' },
  { name: 'NPTEL', url: 'https://nptel.ac.in', courses: 2700, country: 'IN' },
]

const sg = settlegrid.init({
  toolSlug: 'course-catalog',
  pricing: { defaultCostCents: 2, methods: {
    search_courses: { costCents: 2, displayName: 'Search Courses' },
    get_subjects: { costCents: 2, displayName: 'Get Subjects' },
    get_universities: { costCents: 2, displayName: 'Get Universities' },
  }},
})

const searchCourses = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const q = encodeURIComponent(args.query)
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}+course+lecture&format=json&srlimit=${Math.min(args.limit ?? 5, 10)}&origin=*`, {
      signal: controller.signal, headers: { 'User-Agent': 'settlegrid-course-catalog/1.0' },
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json() as { query?: { search: Array<{ title: string; snippet: string }> } }
    const results = (data.query?.search ?? []).map(r => ({
      title: r.title,
      snippet: r.snippet.replace(/<[^>]*>/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    }))
    return { query: args.query, results, count: results.length }
  } catch {
    return { query: args.query, results: [], count: 0, note: 'Search temporarily unavailable' }
  } finally { clearTimeout(timeout) }
}, { method: 'search_courses' })

const getSubjects = sg.wrap(async (_a: Record<string, never>) => {
  return { count: Object.keys(SUBJECTS).length, subjects: Object.entries(SUBJECTS).map(([key, v]) => ({ key, ...v })) }
}, { method: 'get_subjects' })

const getUniversities = sg.wrap(async (_a: Record<string, never>) => {
  return { count: UNIVERSITIES.length, universities: UNIVERSITIES, total_courses: UNIVERSITIES.reduce((s, u) => s + u.courses, 0) }
}, { method: 'get_universities' })

export { searchCourses, getSubjects, getUniversities }
console.log('settlegrid-course-catalog MCP server ready')
console.log('Methods: search_courses, get_subjects, get_universities')
console.log('Pricing: 2c per call | Powered by SettleGrid')
