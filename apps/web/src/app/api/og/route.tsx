import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1A1F3A',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Grid dots */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '28px',
            marginBottom: '40px',
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', gap: '28px' }}>
              {[0, 1, 2].map((col) => {
                const isCenter = row === 1 && col === 1
                const isEdge = (row + col) % 2 !== 0
                return (
                  <div
                    key={col}
                    style={{
                      width: isCenter ? '32px' : '24px',
                      height: isCenter ? '32px' : '24px',
                      borderRadius: '50%',
                      backgroundColor: '#E5A336',
                      opacity: isEdge ? 1 : 0.35,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-1.5px',
            }}
          >
            Settle
          </span>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 400,
              color: '#E5A336',
              letterSpacing: '-1.5px',
            }}
          >
            Grid
          </span>
        </div>
        {/* Subtitle */}
        <span
          style={{
            fontSize: '24px',
            fontWeight: 400,
            color: '#8B92B0',
            marginTop: '12px',
          }}
        >
          The Settlement Layer for the AI Economy
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
