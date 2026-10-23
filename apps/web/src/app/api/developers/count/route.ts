import { NextResponse } from 'next/server'
import { countFoundingMembers } from '@/lib/founding'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Founding-member slots taken (of FOUNDING_MEMBER_LIMIT), for the register page banner. */
export async function GET() {
  try {
    const count = await countFoundingMembers()

    return NextResponse.json(
      { count },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    )
  } catch (err) {
    logger.error('developers.count_failed', {}, err)
    // null hides the banner rather than claiming "0 of 100".
    return NextResponse.json({ count: null }, { status: 200 })
  }
}
