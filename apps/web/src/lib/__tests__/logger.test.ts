import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture console output
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
}

import { logger } from '@/lib/logger'

describe('Structured logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logger.info emits JSON to console.log', () => {
    logger.info('test.event', { key: 'value' })

    expect(consoleSpy.log).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    expect(line.level).toBe('info')
    expect(line.msg).toBe('test.event')
    expect(line.key).toBe('value')
    expect(line.ts).toBeDefined()
  })

  it('logger.warn emits JSON to console.warn', () => {
    logger.warn('warning.event', { code: 42 })

    expect(consoleSpy.warn).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(line.level).toBe('warn')
    expect(line.msg).toBe('warning.event')
    expect(line.code).toBe(42)
  })

  it('logger.error emits JSON to console.error with error details', () => {
    const err = new Error('something broke')
    logger.error('error.event', { context: 'test' }, err)

    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.level).toBe('error')
    expect(line.msg).toBe('error.event')
    expect(line.context).toBe('test')
    expect(line.error).toBe('something broke')
    expect(line.stack).toContain('Error: something broke')
  })

  it('logger.error handles non-Error objects as error argument', () => {
    logger.error('error.event', {}, 'string-error')

    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.error).toBe('string-error')
    expect(line.stack).toBeUndefined()
  })

  it('logger.info works without metadata', () => {
    logger.info('simple.event')

    expect(consoleSpy.log).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    expect(line.level).toBe('info')
    expect(line.msg).toBe('simple.event')
  })

  it('emitted JSON includes ISO timestamp', () => {
    logger.info('ts.test')

    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    // Verify it's a valid ISO date string
    const parsed = new Date(line.ts)
    expect(parsed.getTime()).not.toBeNaN()
  })
})
