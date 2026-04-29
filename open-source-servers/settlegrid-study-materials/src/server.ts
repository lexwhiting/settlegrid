/**
 * settlegrid-study-materials — Study Materials & Techniques MCP Server
 *
 * Study Materials & Techniques tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const TECHNIQUES: Record<string, { description: string; effectiveness: string; best_for: string[]; steps: string[] }> = {
  spaced_repetition: { description: 'Review material at increasing intervals to strengthen memory', effectiveness: 'Very High', best_for: ['memorization', 'vocabulary', 'facts'], steps: ['Learn material', 'Review after 1 day', 'Review after 3 days', 'Review after 7 days', 'Review after 14 days', 'Review after 30 days'] },
  pomodoro: { description: '25-minute focused work sessions with 5-minute breaks', effectiveness: 'High', best_for: ['sustained focus', 'writing', 'problem solving'], steps: ['Choose task', 'Set 25-min timer', 'Work with full focus', 'Take 5-min break', 'Every 4 pomodoros, take 15-30 min break'] },
  feynman: { description: 'Explain a concept in simple terms to find knowledge gaps', effectiveness: 'Very High', best_for: ['deep understanding', 'complex topics'], steps: ['Choose concept', 'Explain as if teaching a child', 'Identify gaps in explanation', 'Go back to source material', 'Simplify and use analogies'] },
  active_recall: { description: 'Test yourself repeatedly without looking at notes', effectiveness: 'Very High', best_for: ['exam prep', 'long-term retention'], steps: ['Study material', 'Close notes', 'Write down everything you remember', 'Check what you missed', 'Focus review on gaps'] },
  mind_mapping: { description: 'Create visual diagrams connecting related concepts', effectiveness: 'Moderate', best_for: ['brainstorming', 'overview', 'visual learners'], steps: ['Write central topic', 'Add main branches', 'Add sub-branches', 'Use colors and images', 'Review connections'] },
  cornell_notes: { description: 'Divide page into notes, cues, and summary sections', effectiveness: 'High', best_for: ['lectures', 'reading', 'review'], steps: ['Draw line creating 2 columns + bottom section', 'Right column: take notes during class', 'Left column: write cue words/questions after', 'Bottom: write summary', 'Review using cues to quiz yourself'] },
}

const sg = settlegrid.init({ toolSlug: 'study-materials', pricing: { defaultCostCents: 1, methods: {
  get_technique: { costCents: 1, displayName: 'Get Study Technique' },
  get_schedule: { costCents: 1, displayName: 'Get Study Schedule' },
  list_techniques: { costCents: 1, displayName: 'List Techniques' },
}}})

const getTechnique = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error('name required')
  const t = TECHNIQUES[args.name.toLowerCase().replace(/ /g, '_')]
  if (!t) throw new Error(`Unknown technique. Available: ${Object.keys(TECHNIQUES).join(', ')}`)
  return { technique: args.name, ...t }
}, { method: 'get_technique' })

const getSchedule = sg.wrap(async (args: { hours_per_day: number; exam_days: number; subjects: string[] }) => {
  if (!args.hours_per_day || !args.exam_days || !args.subjects?.length) throw new Error('hours_per_day, exam_days, subjects required')
  const perSubject = Math.round(args.hours_per_day * args.exam_days / args.subjects.length * 10) / 10
  return { hours_per_day: args.hours_per_day, days: args.exam_days, schedule: args.subjects.map(s => ({ subject: s, total_hours: perSubject, daily_hours: Math.round(args.hours_per_day / args.subjects.length * 10) / 10 })), tips: ['Start with weakest subject', 'Use active recall', 'Take regular breaks', 'Sleep 7-8 hours', 'Review before bed'] }
}, { method: 'get_schedule' })

const listTechniques = sg.wrap(async (_a: Record<string, never>) => {
  return { techniques: Object.entries(TECHNIQUES).map(([name, t]) => ({ name, effectiveness: t.effectiveness, description: t.description })), count: Object.keys(TECHNIQUES).length }
}, { method: 'list_techniques' })

export { getTechnique, getSchedule, listTechniques }
console.log('settlegrid-study-materials MCP server ready | Powered by SettleGrid')
