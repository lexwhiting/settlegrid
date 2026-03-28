import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(developers)

    const count = result[0]?.count ?? 0

    return NextResponse.json(
      { count },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    )
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
