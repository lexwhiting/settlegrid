/**
 * settlegrid-epidemic-tracker — Disease Outbreak Data MCP Server
 *
 * Tracks infectious disease outbreaks using WHO data and local reference DB.
 * Provides outbreak alerts, disease profiles, and regional statistics.
 *
 * Methods:
 *   get_outbreaks(region?)        — Get active outbreaks            (2c)
 *   get_disease(name)             — Get disease profile             (2c)
 *   get_statistics(disease?)      — Get global health statistics    (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetOutbreaksInput { region?: string }
interface GetDiseaseInput { name: string }
interface GetStatsInput { disease?: string }

const OUTBREAKS: Array<{ disease: string; region: string; status: string; cases: number; deaths: number; start_date: string; who_grade: string }> = [
  { disease: 'Mpox', region: 'Central Africa', status: 'ongoing', cases: 14500, deaths: 620, start_date: '2023-01-01', who_grade: '3' },
  { disease: 'Cholera', region: 'Eastern Mediterranean', status: 'ongoing', cases: 89000, deaths: 1200, start_date: '2023-03-01', who_grade: '2' },
  { disease: 'Dengue', region: 'Americas', status: 'seasonal', cases: 4500000, deaths: 2100, start_date: '2024-01-01', who_grade: '2' },
  { disease: 'Measles', region: 'South-East Asia', status: 'ongoing', cases: 320000, deaths: 850, start_date: '2023-06-01', who_grade: '2' },
  { disease: 'Avian Influenza H5N1', region: 'Global', status: 'monitoring', cases: 240, deaths: 55, start_date: '2022-01-01', who_grade: '1' },
]

const DISEASES: Record<string, { transmission: string; incubation: string; mortality_rate: string; vaccine: boolean; treatment: string; r0: string }> = {
  cholera: { transmission: 'Contaminated water/food', incubation: '12h-5 days', mortality_rate: '1% (treated), 25-50% (untreated)', vaccine: true, treatment: 'ORS, antibiotics', r0: '1.4-2.8' },
  dengue: { transmission: 'Aedes mosquito', incubation: '4-10 days', mortality_rate: '1% (treated), 20% (severe)', vaccine: true, treatment: 'Supportive care', r0: '1.5-6.3' },
  measles: { transmission: 'Airborne/droplet', incubation: '10-14 days', mortality_rate: '0.1-0.3%', vaccine: true, treatment: 'Supportive, Vitamin A', r0: '12-18' },
  ebola: { transmission: 'Bodily fluids', incubation: '2-21 days', mortality_rate: '25-90%', vaccine: true, treatment: 'Supportive, monoclonal antibodies', r0: '1.5-2.5' },
  malaria: { transmission: 'Anopheles mosquito', incubation: '7-30 days', mortality_rate: '0.3% (treated)', vaccine: true, treatment: 'Antimalarials (ACT)', r0: '1-3000 (varies)' },
  tuberculosis: { transmission: 'Airborne', incubation: '2-12 weeks', mortality_rate: '15% (untreated)', vaccine: true, treatment: '6-9 month antibiotics', r0: '0.26-4.3' },
}

const sg = settlegrid.init({
  toolSlug: 'epidemic-tracker',
  pricing: { defaultCostCents: 2, methods: {
    get_outbreaks: { costCents: 2, displayName: 'Get Outbreaks' },
    get_disease: { costCents: 2, displayName: 'Get Disease Profile' },
    get_statistics: { costCents: 2, displayName: 'Get Statistics' },
  }},
})

const getOutbreaks = sg.wrap(async (args: GetOutbreaksInput) => {
  let results = [...OUTBREAKS]
  if (args.region) results = results.filter(o => o.region.toLowerCase().includes(args.region!.toLowerCase()))
  return { count: results.length, outbreaks: results, source: 'Reference data based on WHO reports' }
}, { method: 'get_outbreaks' })

const getDisease = sg.wrap(async (args: GetDiseaseInput) => {
  if (!args.name) throw new Error('name required')
  const d = DISEASES[args.name.toLowerCase().replace(/ /g, '_')]
  if (!d) throw new Error(`Unknown disease. Available: ${Object.keys(DISEASES).join(', ')}`)
  return { disease: args.name, ...d }
}, { method: 'get_disease' })

const getStatistics = sg.wrap(async (args: GetStatsInput) => {
  if (args.disease) {
    const outbreak = OUTBREAKS.find(o => o.disease.toLowerCase().includes(args.disease!.toLowerCase()))
    if (outbreak) return { disease: args.disease, ...outbreak, cfr_pct: Math.round((outbreak.deaths / Math.max(outbreak.cases, 1)) * 10000) / 100 }
  }
  return {
    total_active_outbreaks: OUTBREAKS.length,
    total_cases: OUTBREAKS.reduce((s, o) => s + o.cases, 0),
    total_deaths: OUTBREAKS.reduce((s, o) => s + o.deaths, 0),
    by_grade: { grade_3: OUTBREAKS.filter(o => o.who_grade === '3').length, grade_2: OUTBREAKS.filter(o => o.who_grade === '2').length, grade_1: OUTBREAKS.filter(o => o.who_grade === '1').length },
  }
}, { method: 'get_statistics' })

export { getOutbreaks, getDisease, getStatistics }
console.log('settlegrid-epidemic-tracker MCP server ready')
console.log('Methods: get_outbreaks, get_disease, get_statistics')
console.log('Pricing: 2c per call | Powered by SettleGrid')
