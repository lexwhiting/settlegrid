import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'SettleGrid vs. Nevermined: Honest Comparison'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0C0E14',
          color: '#F4F4F5',
        }}
      >
        <div
          style={{
            color: '#E5A336',
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 32,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Comparison
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>SettleGrid vs.</span>
          <span>Nevermined</span>
        </div>
        <div style={{ fontSize: 36, color: '#A1A1AA', marginBottom: 60 }}>
          Honest side-by-side comparison
        </div>
        <div style={{ fontSize: 22, color: '#71717A' }}>
          Cited claims · honest tradeoffs · source-tracked
        </div>
      </div>
    ),
    { ...size },
  )
}
