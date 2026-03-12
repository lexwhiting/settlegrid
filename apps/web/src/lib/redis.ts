import { Redis } from '@upstash/redis'
import { getRedisUrl, getUpstashRedisRestToken } from './env'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    const url = getRedisUrl()
    const token = getUpstashRedisRestToken()
    redisInstance = new Redis({
      url,
      token,
    })
  }
  return redisInstance
}

/**
 * Try to execute a Redis operation, returning null on failure.
 * Used for graceful degradation when Redis is unavailable.
 */
export async function tryRedis<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}
