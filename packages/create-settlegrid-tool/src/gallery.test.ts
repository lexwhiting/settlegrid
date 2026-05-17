import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import {
  isValidGallerySlug,
  classifyGigetError,
  gallerySource,
  defaultGalleryDir,
  downloadGalleryTemplate,
  ScaffoldError,
} from './gallery.js'

// giget is dynamically imported inside downloadGalleryTemplate;
// vi.mock intercepts both static and dynamic imports.
vi.mock('giget', () => ({
  downloadTemplate: vi.fn(),
}))
import { downloadTemplate } from 'giget'
const mockDownload = downloadTemplate as unknown as ReturnType<typeof vi.fn>

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-gallery-'))
  mockDownload.mockReset()
  mockDownload.mockResolvedValue({})
})

afterEach(async () => {
  await fs.remove(tmp)
})

describe('isValidGallerySlug', () => {
  it.each(['tmdb', 'api-football', 'flight-prices', 'cve-search', 'a', 'a1', 'x9-y9'])(
    'accepts %p',
    (slug) => {
      expect(isValidGallerySlug(slug)).toBe(true)
    },
  )

  it.each([
    '',
    '..',
    '../etc/passwd',
    'foo/bar',
    'Foo',
    'foo_bar',
    '-foo',
    'foo-',
    'foo--bar',
    'foo bar',
    'foo.bar',
    'a'.repeat(65),
  ])('rejects %p', (slug) => {
    expect(isValidGallerySlug(slug)).toBe(false)
  })
})

describe('classifyGigetError', () => {
  it('maps 404 / not-found to template_not_found', () => {
    expect(
      classifyGigetError(new Error('Failed to download ...: 404 Not Found')),
    ).toBe('template_not_found')
    expect(classifyGigetError(new Error('Not Found'))).toBe('template_not_found')
  })

  it('maps permission / disk errors to write_failed', () => {
    expect(classifyGigetError(new Error('EACCES: permission denied'))).toBe(
      'write_failed',
    )
    expect(
      classifyGigetError(new Error('ENOSPC: no space left on device')),
    ).toBe('write_failed')
  })

  it('maps network / archive errors to download_failed', () => {
    expect(classifyGigetError(new Error('fetch failed'))).toBe('download_failed')
    expect(classifyGigetError(new Error('TAR_BAD_ARCHIVE'))).toBe(
      'download_failed',
    )
    expect(
      classifyGigetError(new Error('getaddrinfo ENOTFOUND github.com')),
    ).toBe('download_failed')
  })

  it('handles non-Error values', () => {
    expect(classifyGigetError('weird string')).toBe('download_failed')
    expect(classifyGigetError(undefined)).toBe('download_failed')
  })
})

describe('gallerySource / defaultGalleryDir', () => {
  it('builds the giget source spec', () => {
    expect(gallerySource('tmdb')).toBe('github:settlegrid/settlegrid-tmdb')
    expect(gallerySource('api-football')).toBe(
      'github:settlegrid/settlegrid-api-football',
    )
  })

  it('builds the default directory name', () => {
    expect(defaultGalleryDir('tmdb')).toBe('settlegrid-tmdb')
    expect(defaultGalleryDir('api-football')).toBe('settlegrid-api-football')
  })
})

describe('downloadGalleryTemplate', () => {
  it('rejects an invalid slug as template_not_found, never calling giget', async () => {
    await expect(
      downloadGalleryTemplate('../evil', path.join(tmp, 'out')),
    ).rejects.toMatchObject({ name: 'ScaffoldError', code: 'template_not_found' })
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('rejects an empty slug with a missing-slug message', async () => {
    let caught: unknown
    try {
      await downloadGalleryTemplate('', path.join(tmp, 'out'))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScaffoldError)
    expect((caught as ScaffoldError).code).toBe('template_not_found')
    expect((caught as ScaffoldError).message).toMatch(/missing template slug/i)
  })

  it('rejects a non-empty target dir as write_failed, never calling giget', async () => {
    const dir = path.join(tmp, 'occupied')
    await fs.ensureDir(dir)
    await fs.writeFile(path.join(dir, 'existing.txt'), 'data')
    await expect(downloadGalleryTemplate('tmdb', dir)).rejects.toMatchObject({
      code: 'write_failed',
    })
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('downloads into an absent dir with the right giget source + opts', async () => {
    const dir = path.join(tmp, 'fresh')
    await downloadGalleryTemplate('tmdb', dir)
    expect(mockDownload).toHaveBeenCalledWith(
      'github:settlegrid/settlegrid-tmdb',
      { dir, force: true },
    )
  })

  it('allows an existing but empty target dir', async () => {
    const dir = path.join(tmp, 'empty')
    await fs.ensureDir(dir)
    await downloadGalleryTemplate('tmdb', dir)
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })

  it('maps a giget 404 to a template_not_found ScaffoldError', async () => {
    mockDownload.mockRejectedValueOnce(
      new Error('Failed to download tarball: 404 Not Found'),
    )
    await expect(
      downloadGalleryTemplate('ghostzzz', path.join(tmp, 'g')),
    ).rejects.toMatchObject({ name: 'ScaffoldError', code: 'template_not_found' })
  })

  it('maps a giget network failure to a download_failed ScaffoldError', async () => {
    mockDownload.mockRejectedValueOnce(new Error('fetch failed'))
    await expect(
      downloadGalleryTemplate('tmdb', path.join(tmp, 'n')),
    ).rejects.toMatchObject({ code: 'download_failed' })
  })

  it('throws a real ScaffoldError instance', async () => {
    let caught: unknown
    try {
      await downloadGalleryTemplate('Bad Slug', path.join(tmp, 'b'))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScaffoldError)
    expect(caught).toBeInstanceOf(Error)
  })
})
