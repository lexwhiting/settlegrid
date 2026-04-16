import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── getChangedTemplateDirs tests ───────────────────────────────────────────

describe('quality-gates', () => {
  describe('parseChangedTemplateDirs (pure, with fixture)', () => {
    it('extracts template dirs from fake git diff output', async () => {
      const { parseChangedTemplateDirs } = await import('./quality-gates')

      const fakeDiff = [
        'open-source-servers/settlegrid-weather/template.json',
        'open-source-servers/settlegrid-weather/README.md',
        'open-source-servers/settlegrid-nasa/src/server.ts',
        'packages/create-settlegrid-tool/templates/basic/template.json',
        'apps/web/src/app/page.tsx',
        'scripts/build-registry.ts',
        '',
      ].join('\n')

      const dirs = parseChangedTemplateDirs(fakeDiff, [
        '/repo/open-source-servers',
        '/repo/packages/create-settlegrid-tool/templates',
      ], '/repo')

      expect(dirs).toHaveLength(3)
      expect(dirs).toContain('/repo/open-source-servers/settlegrid-weather')
      expect(dirs).toContain('/repo/open-source-servers/settlegrid-nasa')
      expect(dirs).toContain('/repo/packages/create-settlegrid-tool/templates/basic')
    })

    it('deduplicates dirs when multiple files in same template change', async () => {
      const { parseChangedTemplateDirs } = await import('./quality-gates')

      const fakeDiff = [
        'open-source-servers/settlegrid-x/template.json',
        'open-source-servers/settlegrid-x/README.md',
        'open-source-servers/settlegrid-x/src/server.ts',
      ].join('\n')

      const dirs = parseChangedTemplateDirs(fakeDiff, [
        '/repo/open-source-servers',
      ], '/repo')

      expect(dirs).toHaveLength(1)
    })

    it('returns empty for changes outside template roots', async () => {
      const { parseChangedTemplateDirs } = await import('./quality-gates')

      const fakeDiff = 'apps/web/src/app/page.tsx\nscripts/foo.ts\n'
      const dirs = parseChangedTemplateDirs(fakeDiff, [
        '/repo/open-source-servers',
      ], '/repo')

      expect(dirs).toHaveLength(0)
    })

    it('returns empty for empty diff output', async () => {
      const { parseChangedTemplateDirs } = await import('./quality-gates')

      const dirs = parseChangedTemplateDirs('', ['/repo/open-source-servers'], '/repo')
      expect(dirs).toHaveLength(0)
    })

    it('rejects unsafe slug components (.., ., empty, separator-bearing)', async () => {
      const { parseChangedTemplateDirs } = await import('./quality-gates')

      const fakeDiff = [
        'open-source-servers/../escape/template.json',
        'open-source-servers/./template.json',
        'open-source-servers//template.json',
        'open-source-servers/legit/template.json',
      ].join('\n')

      const dirs = parseChangedTemplateDirs(fakeDiff, [
        '/repo/open-source-servers',
      ], '/repo')

      // Only the legit slug survives the safety filter.
      expect(dirs).toEqual(['/repo/open-source-servers/legit'])
    })
  })

  describe('getChangedTemplateDirs (live git)', () => {
    it('returns an array of paths under template roots', async () => {
      const { getChangedTemplateDirs } = await import('./quality-gates')
      const dirs = getChangedTemplateDirs()
      expect(Array.isArray(dirs)).toBe(true)
      for (const dir of dirs) {
        expect(
          dir.includes('open-source-servers') ||
          dir.includes('create-settlegrid-tool/templates'),
        ).toBe(true)
      }
    })
  })

  describe('runQualityGates', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sg-qg-test-'))
    })

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true })
    })

    it('validates valid template.json files', async () => {
      const { runQualityGates } = await import('./quality-gates')

      // Run against real open-source-servers/ (has 20 canonical templates)
      const summary = await runQualityGates({ onlyChanged: false })

      expect(summary.total).toBeGreaterThanOrEqual(20)
      expect(summary.failed).toBe(0)
      expect(summary.passed).toBe(summary.total)
    })

    it('--only-changed with no changed templates exits cleanly', async () => {
      const { runQualityGates } = await import('./quality-gates')

      // When run from main (no diff), should find 0 changed templates
      const summary = await runQualityGates({ onlyChanged: true })

      // May or may not find changes depending on branch state
      expect(summary.failed).toBe(0)
    })

    it('--json emits machine-readable output', async () => {
      const { runQualityGates } = await import('./quality-gates')

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      await runQualityGates({ onlyChanged: true, json: true })

      // Should have called console.log with valid JSON
      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty('total')
      expect(parsed).toHaveProperty('passed')
      expect(parsed).toHaveProperty('failed')
      expect(parsed).toHaveProperty('results')

      consoleSpy.mockRestore()
    })
  })
})
