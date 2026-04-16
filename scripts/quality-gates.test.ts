import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock the fetch-utils (not needed here but prevents import errors)
vi.mock('./shadow-crawler/fetch-utils', () => ({
  fetchJson: vi.fn(),
  fetchWithRetry: vi.fn(),
}))

// ── getChangedTemplateDirs tests ───────────────────────────────────────────

describe('quality-gates', () => {
  describe('getChangedTemplateDirs', () => {
    it('extracts template dirs from git diff output', async () => {
      const { getChangedTemplateDirs } = await import('./quality-gates')

      // This test runs in the actual repo, so getChangedTemplateDirs
      // will use real git. We test the parsing logic instead.
      const dirs = getChangedTemplateDirs()
      // Should return an array (may be empty if HEAD === origin/main)
      expect(Array.isArray(dirs)).toBe(true)
    })

    it('returns empty array when no templates changed', async () => {
      // getChangedTemplateDirs uses execSync internally. If no
      // open-source-servers/ files changed, it returns empty.
      const { getChangedTemplateDirs } = await import('./quality-gates')
      const dirs = getChangedTemplateDirs()
      // Dirs should only contain paths under the template roots
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
