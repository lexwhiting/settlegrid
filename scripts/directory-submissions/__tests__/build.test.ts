import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, readFile, rm, mkdtemp, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildPackets,
  loadDirectories,
  parseGithubUrl,
  pickDescription,
  renderIndex,
  renderPacket,
  validateDirectory,
  type DirectoriesFile,
  type Directory,
} from '../build.js'
import { projectMetadata as realProjectMetadata } from '../project-metadata.js'
import type { ProjectMetadata } from '../project-metadata.js'

// ── Fixtures ───────────────────────────────────────────────────────────────

const FIXTURE_PROJECT: ProjectMetadata = {
  name: 'TestProject',
  tagline: 'A test tagline',
  descriptionShort: 'Short desc under 80 chars for tests.',
  descriptionMedium:
    'Medium-length description, stays well under 140 chars, for awesome-list tests.',
  descriptionLong:
    'Long description that can be several hundred characters. It covers everything the project is, does, and wants to be. Long enough to test length-sensitive rendering.',
  tags: ['test', 'scaffold', 'example'],
  urls: {
    homepage: 'https://example.test',
    github: 'https://github.com/testowner/testrepo',
    npmPackage: 'https://www.npmjs.com/package/testpkg',
    docs: 'https://example.test/docs',
    demo: null,
  },
  logo: [
    {
      path: 'assets/icon.svg',
      format: 'svg',
      description: 'icon',
    },
    {
      path: 'assets/logo-light.svg',
      format: 'svg',
      description: 'wordmark light',
    },
    {
      path: 'assets/logo-dark.svg',
      format: 'svg',
      description: 'wordmark dark',
    },
    {
      path: 'assets/favicon-32.png',
      format: 'png',
      description: 'favicon',
    },
  ],
  screenshots: ['assets/ss1.jpg', 'assets/ss with space.jpg'],
  author: {
    name: 'Test Author',
    githubHandle: 'testhandle',
    email: 'test@example.test',
  },
}

function makeDir(overrides: Partial<Directory> = {}): Directory {
  return {
    slug: 'sample-dir',
    name: 'Sample Directory',
    homepage: 'https://sample.example',
    submissionType: 'form',
    submissionUrl: 'https://sample.example/submit',
    submissionStatus: 'verified',
    requiredFields: ['name', 'repoUrl', 'description'],
    charLimits: {
      description: { max: 200, source: 'docs' },
    },
    logoRequirement: null,
    descriptionVariant: 'medium',
    prFormat: null,
    instructions: 'Fill the form. Click submit.',
    notes: 'No special notes.',
    ...overrides,
  }
}

// ── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'p37-build-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ── parseGithubUrl ─────────────────────────────────────────────────────────

describe('parseGithubUrl', () => {
  it('parses a standard URL', () => {
    expect(parseGithubUrl('https://github.com/foo/bar')).toEqual({
      owner: 'foo',
      repo: 'bar',
    })
  })

  it('parses a URL with .git suffix', () => {
    expect(parseGithubUrl('https://github.com/foo/bar.git')).toEqual({
      owner: 'foo',
      repo: 'bar',
    })
  })

  it('parses a URL with trailing slash', () => {
    expect(parseGithubUrl('https://github.com/foo/bar/')).toEqual({
      owner: 'foo',
      repo: 'bar',
    })
  })

  it('throws on non-GitHub URL', () => {
    expect(() => parseGithubUrl('https://gitlab.com/foo/bar')).toThrow(
      /Not a GitHub web URL/,
    )
  })

  it('throws on URL with extra path segments', () => {
    // We intentionally reject these because the packet renderer needs
    // exactly owner/repo; deeper paths would silently corrupt raw URLs.
    expect(() =>
      parseGithubUrl('https://github.com/foo/bar/tree/main'),
    ).toThrow(/Not a GitHub web URL/)
  })
})

// ── pickDescription ────────────────────────────────────────────────────────

describe('pickDescription', () => {
  it('returns short variant', () => {
    expect(pickDescription(FIXTURE_PROJECT, 'short')).toBe(
      FIXTURE_PROJECT.descriptionShort,
    )
  })

  it('returns medium variant', () => {
    expect(pickDescription(FIXTURE_PROJECT, 'medium')).toBe(
      FIXTURE_PROJECT.descriptionMedium,
    )
  })

  it('returns long variant', () => {
    expect(pickDescription(FIXTURE_PROJECT, 'long')).toBe(
      FIXTURE_PROJECT.descriptionLong,
    )
  })
})

// ── validateDirectory ──────────────────────────────────────────────────────

describe('validateDirectory', () => {
  it('reports no warnings on a well-formed directory', () => {
    const w = validateDirectory(makeDir(), FIXTURE_PROJECT)
    expect(w).toEqual([])
  })

  it('flags when description exceeds char limit', () => {
    const dir = makeDir({
      charLimits: { description: { max: 20, source: 'tight fake limit' } },
      descriptionVariant: 'medium', // 77 chars
    })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w).toHaveLength(1)
    expect(w[0].field).toBe('description')
    expect(w[0].message).toMatch(/exceeds declared description limit 20/)
  })

  it('does not flag when description fits char limit', () => {
    const dir = makeDir({
      charLimits: { description: { max: 500, source: 'generous' } },
      descriptionVariant: 'medium',
    })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w).toEqual([])
  })

  it('flags a bad slug', () => {
    const dir = makeDir({ slug: 'Bad_Slug' })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w.some((x) => x.field === 'slug')).toBe(true)
  })

  it('flags a non-HTTPS homepage', () => {
    const dir = makeDir({ homepage: 'http://sample.example' })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w.some((x) => x.field === 'homepage')).toBe(true)
  })

  it('flags a non-HTTPS submissionUrl', () => {
    const dir = makeDir({ submissionUrl: 'http://sample.example/submit' })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w.some((x) => x.field === 'submissionUrl')).toBe(true)
  })

  it('allows a null submissionUrl', () => {
    const dir = makeDir({ submissionUrl: null })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w).toEqual([])
  })

  it('flags unknown required field', () => {
    const dir = makeDir({ requiredFields: ['name', 'bogusField'] })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w.some((x) => x.message.includes('bogusField'))).toBe(true)
  })

  it('flags PR-type directory without prFormat', () => {
    const dir = makeDir({ submissionType: 'pr', prFormat: null })
    const w = validateDirectory(dir, FIXTURE_PROJECT)
    expect(w.some((x) => x.field === 'prFormat')).toBe(true)
  })
})

// ── renderPacket ───────────────────────────────────────────────────────────

describe('renderPacket', () => {
  it('includes project name, tagline, and description', () => {
    const out = renderPacket(makeDir(), FIXTURE_PROJECT)
    expect(out).toContain('TestProject')
    expect(out).toContain('A test tagline')
    expect(out).toContain(FIXTURE_PROJECT.descriptionMedium)
  })

  it('includes char-limit table when charLimits is non-empty', () => {
    const out = renderPacket(makeDir(), FIXTURE_PROJECT)
    expect(out).toContain('Character limits:')
    expect(out).toContain('`description`')
  })

  it('includes PR diff section when prFormat is present', () => {
    const dir = makeDir({
      submissionType: 'pr',
      prFormat: {
        file: 'README.md',
        categoryHint: 'AI & ML',
        entryTemplate: '- [{name}]({github}) - {description}',
      },
    })
    const out = renderPacket(dir, FIXTURE_PROJECT)
    expect(out).toContain('## 3. Exact PR diff')
    expect(out).toContain('```diff')
    expect(out).toContain(
      '+- [TestProject](https://github.com/testowner/testrepo) - ',
    )
  })

  it('does not include PR diff when prFormat is null', () => {
    const out = renderPacket(makeDir(), FIXTURE_PROJECT)
    expect(out).not.toContain('## 3. Exact PR diff')
  })

  it('renders logo-conversion instructions when logoRequirement set', () => {
    const dir = makeDir({
      logoRequirement: { width: 400, height: 400, format: 'png' },
    })
    const out = renderPacket(dir, FIXTURE_PROJECT)
    expect(out).toContain('400×400 PNG')
    expect(out).toContain('sharp-cli')
  })

  it('shows partial banner when status=partial', () => {
    const out = renderPacket(
      makeDir({ submissionStatus: 'partial' }),
      FIXTURE_PROJECT,
    )
    expect(out).toMatch(/Partial verification/)
  })

  it('shows unverified banner when status=unverified', () => {
    const out = renderPacket(
      makeDir({ submissionStatus: 'unverified' }),
      FIXTURE_PROJECT,
    )
    expect(out).toMatch(/Unverified directory/)
  })

  it('URL-encodes spaces in screenshot raw URLs', () => {
    const out = renderPacket(makeDir(), FIXTURE_PROJECT)
    // Fixture has 'assets/ss with space.jpg'. The raw URL must encode
    // the space so it resolves on github.com raw hosting.
    expect(out).toContain('assets/ss%20with%20space.jpg')
    // But the path displayed to the user should remain human-readable.
    expect(out).toContain('`assets/ss with space.jpg`')
  })

  it('includes submission URL if present, placeholder if null', () => {
    const outWith = renderPacket(
      makeDir({ submissionUrl: 'https://x.example/submit' }),
      FIXTURE_PROJECT,
    )
    expect(outWith).toContain('https://x.example/submit')

    const outNull = renderPacket(
      makeDir({ submissionUrl: null }),
      FIXTURE_PROJECT,
    )
    expect(outNull).toContain('_none — see instructions below')
  })
})

// ── renderIndex ────────────────────────────────────────────────────────────

describe('renderIndex', () => {
  it('generates one table row per directory plus header', () => {
    const dirs = [
      makeDir({ slug: 'a', name: 'A' }),
      makeDir({ slug: 'b', name: 'B' }),
      makeDir({ slug: 'c', name: 'C' }),
    ]
    const out = renderIndex(dirs, FIXTURE_PROJECT)
    // Three linkable slugs.
    expect(out).toContain('[`a.md`](./a.md)')
    expect(out).toContain('[`b.md`](./b.md)')
    expect(out).toContain('[`c.md`](./c.md)')
    // Header row and separator.
    expect(out).toContain('| # | Directory |')
    expect(out).toContain('|---|')
  })

  it('lists the default status as not-sent', () => {
    const out = renderIndex([makeDir()], FIXTURE_PROJECT)
    expect(out).toContain('not-sent')
  })
})

// ── buildPackets ───────────────────────────────────────────────────────────

async function writeDirsJson(
  path: string,
  file: DirectoriesFile,
): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(file, null, 2), 'utf-8')
}

describe('buildPackets', () => {
  it('writes one packet per directory plus a README', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    const outDir = join(tmpDir, 'packets')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({ slug: 'dir-a', name: 'Dir A' }),
        makeDir({ slug: 'dir-b', name: 'Dir B' }),
      ],
    })
    const r = await buildPackets({
      directoriesJsonPath: dirsJson,
      outputDir: outDir,
      project: FIXTURE_PROJECT,
    })
    expect(r.packets).toHaveLength(2)
    const files = await readdir(outDir)
    expect(files.sort()).toEqual(['README.md', 'dir-a.md', 'dir-b.md'])
  })

  it('produces sorted output regardless of input order', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    const outDir = join(tmpDir, 'packets')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({ slug: 'zebra' }),
        makeDir({ slug: 'apple' }),
        makeDir({ slug: 'mango' }),
      ],
    })
    const r = await buildPackets({
      directoriesJsonPath: dirsJson,
      outputDir: outDir,
      project: FIXTURE_PROJECT,
    })
    expect(r.packets.map((p) => p.slug)).toEqual(['apple', 'mango', 'zebra'])
  })

  it('--only filter writes only the matching packet', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    const outDir = join(tmpDir, 'packets')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({ slug: 'dir-a', name: 'Dir A' }),
        makeDir({ slug: 'dir-b', name: 'Dir B' }),
      ],
    })
    const r = await buildPackets({
      directoriesJsonPath: dirsJson,
      outputDir: outDir,
      only: 'dir-b',
      project: FIXTURE_PROJECT,
    })
    expect(r.packets).toHaveLength(1)
    expect(r.packets[0].slug).toBe('dir-b')
  })

  it('--only with unknown slug throws', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [makeDir()],
    })
    await expect(
      buildPackets({
        directoriesJsonPath: dirsJson,
        outputDir: join(tmpDir, 'packets'),
        only: 'does-not-exist',
        project: FIXTURE_PROJECT,
      }),
    ).rejects.toThrow(/No directory with slug/)
  })

  it('--strict throws on a validation warning', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({
          // Description variant is 'medium' (77 chars) but the declared
          // limit is 10 — will overflow and trigger a warning.
          charLimits: { description: { max: 10, source: 'tight' } },
        }),
      ],
    })
    await expect(
      buildPackets({
        directoriesJsonPath: dirsJson,
        outputDir: join(tmpDir, 'packets'),
        strict: true,
        project: FIXTURE_PROJECT,
      }),
    ).rejects.toThrow(/Strict mode:/)
  })

  it('detects duplicate slugs and warns', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({ slug: 'dup' }),
        makeDir({ slug: 'dup', name: 'Second' }),
      ],
    })
    const r = await buildPackets({
      directoriesJsonPath: dirsJson,
      outputDir: join(tmpDir, 'packets'),
      project: FIXTURE_PROJECT,
    })
    expect(
      r.warnings.some(
        (w) => w.slug === 'dup' && w.message === 'Duplicate slug',
      ),
    ).toBe(true)
  })

  it('writes a README.md index referencing every generated packet', async () => {
    const dirsJson = join(tmpDir, 'directories.json')
    const outDir = join(tmpDir, 'packets')
    await writeDirsJson(dirsJson, {
      schemaVersion: 1,
      verifiedAt: '2026-04-20',
      directories: [
        makeDir({ slug: 'one', name: 'One' }),
        makeDir({ slug: 'two', name: 'Two' }),
      ],
    })
    await buildPackets({
      directoriesJsonPath: dirsJson,
      outputDir: outDir,
      project: FIXTURE_PROJECT,
    })
    const indexContent = await readFile(join(outDir, 'README.md'), 'utf-8')
    expect(indexContent).toContain('[`one.md`](./one.md)')
    expect(indexContent).toContain('[`two.md`](./two.md)')
  })
})

// ── loadDirectories ────────────────────────────────────────────────────────

describe('loadDirectories', () => {
  it('parses a valid file', async () => {
    const path = join(tmpDir, 'valid.json')
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: 1,
        verifiedAt: '2026-04-20',
        directories: [makeDir()],
      }),
    )
    const f = await loadDirectories(path)
    expect(f.directories).toHaveLength(1)
  })

  it('throws on a malformed shape', async () => {
    const path = join(tmpDir, 'bad.json')
    await writeFile(path, JSON.stringify({ wrongShape: true }))
    await expect(loadDirectories(path)).rejects.toThrow(
      /does not have a valid/,
    )
  })

  it('throws on non-JSON input', async () => {
    const path = join(tmpDir, 'garbage.json')
    await writeFile(path, 'not json at all')
    await expect(loadDirectories(path)).rejects.toThrow()
  })
})

// ── Real directories.json smoke test ───────────────────────────────────────

describe('real directories.json', () => {
  it('the committed directories.json validates cleanly against current project metadata', async () => {
    const r = await buildPackets({
      outputDir: join(tmpDir, 'packets'),
      project: realProjectMetadata,
    })
    // Every declared char limit must be met by the selected description.
    const descriptionLimitViolations = r.warnings.filter(
      (w) =>
        w.field.toLowerCase().includes('description') &&
        w.message.includes('exceeds'),
    )
    expect(descriptionLimitViolations).toEqual([])
  })

  it('the committed directories.json has at least 10 entries (spec floor)', async () => {
    const dirsJson = join(
      import.meta.dirname ?? new URL('.', import.meta.url).pathname,
      '..',
      'directories.json',
    )
    const f = await loadDirectories(dirsJson)
    expect(f.directories.length).toBeGreaterThanOrEqual(10)
  })
})
