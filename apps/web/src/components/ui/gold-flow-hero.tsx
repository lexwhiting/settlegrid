'use client'

import { cn } from '@/lib/utils'

const PROTOCOLS = [
  'MCP', 'x402', 'AP2', 'MPP', 'Visa TAP',
  'UCP', 'ACP', 'Mastercard', 'Circle Nano', 'REST',
  'L402', 'Alipay', 'KYAPay', 'EMVCo', 'DRAIN',
]

interface GoldFlowHeroProps {
  className?: string
}

export function GoldFlowHero({ className }: GoldFlowHeroProps) {
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <svg
        viewBox="0 0 1200 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gold flow gradient: molten at source, settled at endpoints */}
          <linearGradient id="gold-flow" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#F5C963" />
            <stop offset="40%" stopColor="#E5A336" />
            <stop offset="80%" stopColor="#D4961F" />
            <stop offset="100%" stopColor="#C4891E" />
          </linearGradient>

          {/* Glow filter for the main conduit */}
          <filter id="gold-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.64  0 0 0 0 0.13  0 0 0 0.4 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Animated flow dash pattern */}
          <style>{`
            .flow-line {
              stroke-dasharray: 8 12;
              animation: flowDash 2s linear infinite;
            }
            @keyframes flowDash {
              to { stroke-dashoffset: -40; }
            }
            @media (prefers-reduced-motion: reduce) {
              .flow-line { animation: none; }
            }
          `}</style>
        </defs>

        {/* Main conduit: thick gold stream from top center */}
        <path
          d="M600 0 L600 200"
          stroke="url(#gold-flow)"
          strokeWidth="6"
          filter="url(#gold-glow)"
          strokeLinecap="round"
        />

        {/* Junction node: pooling reservoir */}
        <circle cx="600" cy="220" r="12" fill="#E5A336" opacity="0.6" />
        <circle cx="600" cy="220" r="6" fill="#F5C963" />

        {/* 15 tributary paths fanning out */}
        {PROTOCOLS.map((protocol, i) => {
          const angle = -70 + (140 / 14) * i
          const radian = (angle * Math.PI) / 180
          const endX = 600 + Math.sin(radian) * 350
          const endY = 220 + Math.cos(radian) * 300
          const midX = 600 + Math.sin(radian) * 150
          const midY = 220 + Math.cos(radian) * 120
          const opacity = 0.15 + (i % 3) * 0.05

          return (
            <g key={protocol}>
              <path
                d={`M600 220 Q${midX} ${midY} ${endX} ${endY}`}
                stroke="#E5A336"
                strokeWidth="1.5"
                opacity={opacity}
                fill="none"
                className="flow-line"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
              {/* Endpoint pool */}
              <circle cx={endX} cy={endY} r="3" fill="#C4891E" opacity={opacity + 0.1} />
              {/* Protocol label */}
              <text
                x={endX}
                y={endY + 16}
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize="9"
                fontFamily="var(--font-mono)"
                opacity="0.5"
              >
                {protocol}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
