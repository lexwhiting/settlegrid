import { describe, it, expect } from 'vitest'
import { parseArgs } from './args.js'

describe('parseArgs', () => {
  it('returns defaults for empty argv', () => {
    expect(parseArgs([])).toEqual({ help: false, version: false })
  })

  it('detects --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true)
    expect(parseArgs(['-h']).help).toBe(true)
  })

  it('detects --version', () => {
    expect(parseArgs(['--version']).version).toBe(true)
  })

  it('parses --template <slug>', () => {
    expect(parseArgs(['--template', 'tmdb']).template).toBe('tmdb')
  })

  it('parses --template=<slug>', () => {
    expect(parseArgs(['--template=api-football']).template).toBe('api-football')
  })

  it('parses --template <slug> <directory>', () => {
    const p = parseArgs(['--template', 'tmdb', 'my-dir'])
    expect(p.template).toBe('tmdb')
    expect(p.directory).toBe('my-dir')
  })

  it('treats a positional with no --template as a directory (interactive mode)', () => {
    const p = parseArgs(['my-dir'])
    expect(p.template).toBeUndefined()
    expect(p.directory).toBe('my-dir')
  })

  it('records an empty template when --template has no value', () => {
    expect(parseArgs(['--template']).template).toBe('')
  })

  it('records an empty template when --template is followed by a flag', () => {
    const p = parseArgs(['--template', '--help'])
    expect(p.template).toBe('')
    expect(p.help).toBe(true)
  })

  it('ignores unknown flags but still captures the directory', () => {
    const p = parseArgs(['--frobnicate', 'my-dir'])
    expect(p.directory).toBe('my-dir')
    expect(p.template).toBeUndefined()
  })

  it('keeps only the first positional as the directory', () => {
    expect(parseArgs(['first', 'second']).directory).toBe('first')
  })

  it('handles flags and positionals interleaved', () => {
    const p = parseArgs(['my-dir', '--template', 'tmdb'])
    expect(p.directory).toBe('my-dir')
    expect(p.template).toBe('tmdb')
  })
})
