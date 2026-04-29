/**
 * settlegrid-telescope-data — Telescope Database MCP Server
 *
 * Telescope Database tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const TELESCOPES: Record<string, { name: string; type: string; aperture_m: number; location: string; altitude_m: number; first_light: number; wavelengths: string[]; status: string; key_discoveries: string[] }> = {
  jwst: { name: 'James Webb Space Telescope', type: 'infrared reflector', aperture_m: 6.5, location: 'L2 Lagrange point', altitude_m: -1, first_light: 2022, wavelengths: ['near-IR', 'mid-IR'], status: 'operational', key_discoveries: ['Earliest galaxies', 'Exoplanet atmospheres', 'Star formation details'] },
  hubble: { name: 'Hubble Space Telescope', type: 'reflecting', aperture_m: 2.4, location: 'LEO (540 km)', altitude_m: -1, first_light: 1990, wavelengths: ['UV', 'visible', 'near-IR'], status: 'operational', key_discoveries: ['Dark energy acceleration', 'Hubble Deep Field', 'Exoplanet atmospheres'] },
  vlt: { name: 'Very Large Telescope', type: 'reflecting (4 units)', aperture_m: 8.2, location: 'Cerro Paranal, Chile', altitude_m: 2635, first_light: 1998, wavelengths: ['UV', 'visible', 'IR'], status: 'operational', key_discoveries: ['Black hole imaging', 'Exoplanet direct imaging'] },
  keck: { name: 'W. M. Keck Observatory', type: 'segmented reflector', aperture_m: 10.0, location: 'Mauna Kea, Hawaii', altitude_m: 4145, first_light: 1993, wavelengths: ['visible', 'near-IR'], status: 'operational', key_discoveries: ['Exoplanet detection', 'Galaxy evolution'] },
  alma: { name: 'ALMA', type: 'radio interferometer', aperture_m: 12.0, location: 'Atacama, Chile', altitude_m: 5058, first_light: 2011, wavelengths: ['millimeter', 'submillimeter'], status: 'operational', key_discoveries: ['Protoplanetary disks', 'Distant galaxy gas'] },
  elt: { name: 'Extremely Large Telescope', type: 'segmented reflector', aperture_m: 39.3, location: 'Cerro Armazones, Chile', altitude_m: 3046, first_light: 2028, wavelengths: ['visible', 'near-IR', 'mid-IR'], status: 'under construction', key_discoveries: [] },
  fast: { name: 'FAST', type: 'radio', aperture_m: 500, location: 'Guizhou, China', altitude_m: 835, first_light: 2016, wavelengths: ['radio'], status: 'operational', key_discoveries: ['Fast radio bursts', 'Pulsar discoveries'] },
  chandra: { name: 'Chandra X-ray Observatory', type: 'X-ray', aperture_m: 1.2, location: 'HEO', altitude_m: -1, first_light: 1999, wavelengths: ['X-ray'], status: 'operational', key_discoveries: ['Black hole jets', 'Dark matter mapping'] },
}

const sg = settlegrid.init({ toolSlug: 'telescope-data', pricing: { defaultCostCents: 2, methods: {
  get_telescope: { costCents: 2, displayName: 'Get Telescope' },
  list_telescopes: { costCents: 2, displayName: 'List Telescopes' },
  compare: { costCents: 2, displayName: 'Compare Telescopes' },
}}})

const getTelescope = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error('name required')
  const t = TELESCOPES[args.name.toLowerCase().replace(/[- ]/g, '_')]
  if (!t) throw new Error(`Unknown. Available: ${Object.keys(TELESCOPES).join(', ')}`)
  return t
}, { method: 'get_telescope' })

const listTelescopes = sg.wrap(async (args: { type?: string }) => {
  let results = Object.values(TELESCOPES)
  if (args.type) results = results.filter(t => t.type.includes(args.type!.toLowerCase()))
  return { count: results.length, telescopes: results.map(t => ({ name: t.name, type: t.type, aperture_m: t.aperture_m, status: t.status })) }
}, { method: 'list_telescopes' })

const compare = sg.wrap(async (args: { telescope_a: string; telescope_b: string }) => {
  if (!args.telescope_a || !args.telescope_b) throw new Error('telescope_a and telescope_b required')
  const a = TELESCOPES[args.telescope_a.toLowerCase().replace(/[- ]/g, '_')]
  const b = TELESCOPES[args.telescope_b.toLowerCase().replace(/[- ]/g, '_')]
  if (!a || !b) throw new Error('One or both telescopes not found')
  return { a: { name: a.name, aperture_m: a.aperture_m, type: a.type }, b: { name: b.name, aperture_m: b.aperture_m, type: b.type }, aperture_ratio: Math.round(a.aperture_m / b.aperture_m * 100) / 100, light_gathering_ratio: Math.round(Math.pow(a.aperture_m / b.aperture_m, 2) * 100) / 100 }
}, { method: 'compare' })

export { getTelescope, listTelescopes, compare }
console.log('settlegrid-telescope-data MCP server ready | Powered by SettleGrid')
