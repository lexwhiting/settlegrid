/**
 * settlegrid-semver — Semantic Version Parsing MCP Server
 *
 * Parse, compare, and validate semantic versions. All local computation.
 *
 * Methods:
 *   parse_version(version) — Parse a semver string (free)
 *   compare_versions(a, b) — Compare two versions (free)
 *   sort_versions(versions) — Sort version array (free)
 *   satisfies_range(version, range) — Check if version satisfies range (free)
 *   bump_version(version, type) — Bump version (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ParseInput { version: string }
interface CompareInput { a: string; b: string }
interface SortInput { versions: string[] }
interface RangeInput { version: string; range: string }
interface BumpInput { version: string; type: 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease' }

interface SemVer { major: number; minor: number; patch: number; prerelease: string[]; build: string[] }

function parse(v: string): SemVer | null {
  const match = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$/)
  if (!match) return null
  return {
    major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  }
}

function compare(a: string, b: string): number {
  const pa = parse(a), pb = parse(b)
  if (!pa || !pb) throw new Error(`Invalid semver: ${!pa ? a : b}`)
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0
  if (pa.prerelease.length === 0) return 1
  if (pb.prerelease.length === 0) return -1
  for (let i = 0; i < Math.max(pa.prerelease.length, pb.prerelease.length); i++) {
    if (i >= pa.prerelease.length) return -1
    if (i >= pb.prerelease.length) return 1
    const ai = pa.prerelease[i], bi = pb.prerelease[i]
    const an = parseInt(ai), bn = parseInt(bi)
    if (!isNaN(an) && !isNaN(bn)) { if (an !== bn) return an - bn }
    else if (ai !== bi) return ai < bi ? -1 : 1
  }
  return 0
}

const sg = settlegrid.init({
  toolSlug: 'semver',
  pricing: {
    defaultCostCents: 0,
    methods: {
      parse_version: { costCents: 0, displayName: 'Parse Version' },
      compare_versions: { costCents: 0, displayName: 'Compare Versions' },
      sort_versions: { costCents: 0, displayName: 'Sort Versions' },
      satisfies_range: { costCents: 0, displayName: 'Satisfies Range' },
      bump_version: { costCents: 0, displayName: 'Bump Version' },
    },
  },
})

const parseVersion = sg.wrap(async (args: ParseInput) => {
  const v = parse(args.version)
  if (!v) throw new Error(`Invalid semver: ${args.version}`)
  return { raw: args.version, ...v, formatted: `${v.major}.${v.minor}.${v.patch}${v.prerelease.length ? '-' + v.prerelease.join('.') : ''}` }
}, { method: 'parse_version' })

const compareVersions = sg.wrap(async (args: CompareInput) => {
  const result = compare(args.a, args.b)
  return { a: args.a, b: args.b, result, description: result === 0 ? 'equal' : result > 0 ? `${args.a} is newer` : `${args.b} is newer` }
}, { method: 'compare_versions' })

const sortVersions = sg.wrap(async (args: SortInput) => {
  if (!Array.isArray(args.versions)) throw new Error('versions array required')
  const sorted = [...args.versions].sort(compare)
  return { ascending: sorted, descending: [...sorted].reverse(), latest: sorted[sorted.length - 1] }
}, { method: 'sort_versions' })

const satisfiesRange = sg.wrap(async (args: RangeInput) => {
  const v = parse(args.version)
  if (!v) throw new Error(`Invalid version: ${args.version}`)
  const range = args.range.trim()
  let satisfies = false
  if (range.startsWith('^')) {
    const r = parse(range.slice(1))
    if (r) satisfies = v.major === r.major && compare(args.version, range.slice(1)) >= 0
  } else if (range.startsWith('~')) {
    const r = parse(range.slice(1))
    if (r) satisfies = v.major === r.major && v.minor === r.minor && compare(args.version, range.slice(1)) >= 0
  } else if (range.startsWith('>=')) {
    satisfies = compare(args.version, range.slice(2).trim()) >= 0
  } else if (range.startsWith('>')) {
    satisfies = compare(args.version, range.slice(1).trim()) > 0
  } else {
    satisfies = compare(args.version, range) === 0
  }
  return { version: args.version, range, satisfies }
}, { method: 'satisfies_range' })

const bumpVersion = sg.wrap(async (args: BumpInput) => {
  const v = parse(args.version)
  if (!v) throw new Error(`Invalid version: ${args.version}`)
  const bumped = { ...v, prerelease: [] as string[], build: [] as string[] }
  switch (args.type) {
    case 'major': bumped.major++; bumped.minor = 0; bumped.patch = 0; break
    case 'minor': bumped.minor++; bumped.patch = 0; break
    case 'patch': bumped.patch++; break
    case 'premajor': bumped.major++; bumped.minor = 0; bumped.patch = 0; bumped.prerelease = ['0']; break
    case 'preminor': bumped.minor++; bumped.patch = 0; bumped.prerelease = ['0']; break
    case 'prepatch': bumped.patch++; bumped.prerelease = ['0']; break
    case 'prerelease': {
      const last = v.prerelease.length ? parseInt(v.prerelease[v.prerelease.length - 1]) : -1
      bumped.prerelease = isNaN(last) ? [...v.prerelease, '0'] : [...v.prerelease.slice(0, -1), String(last + 1)]
      break
    }
    default: throw new Error(`Invalid bump type: ${args.type}`)
  }
  const result = `${bumped.major}.${bumped.minor}.${bumped.patch}${bumped.prerelease.length ? '-' + bumped.prerelease.join('.') : ''}`
  return { original: args.version, type: args.type, bumped: result }
}, { method: 'bump_version' })

export { parseVersion, compareVersions, sortVersions, satisfiesRange, bumpVersion }

console.log('settlegrid-semver MCP server ready')
console.log('Methods: parse_version, compare_versions, sort_versions, satisfies_range, bump_version')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
