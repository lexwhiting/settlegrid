'use client'

import { useState } from 'react'

interface CopyableCodeBlockProps {
  code: string
  language?: string
  title?: string
  className?: string
}

function highlightCode(code: string): React.ReactNode[] {
  const tokenPattern = /\/\/[^\n]*|#[^\n]*|'[^']*'|"[^"]*"|`[^`]*`|\b(import|from|export|const|let|var|function|async|await|return|if|else|try|catch|throw|new|interface|type|extends|class|default|number|string|boolean|void|true|false|null|undefined|assert)\b/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('//') || token.startsWith('#')) {
      parts.push(<span key={match.index} className="text-gray-500 italic">{token}</span>)
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
      parts.push(<span key={match.index} className="text-amber-300">{token}</span>)
    } else {
      parts.push(<span key={match.index} className="text-emerald-400">{token}</span>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex))
  }
  return parts
}

export function CopyableCodeBlock({ code, language, title, className }: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={`my-4 ${className ?? ''}`}>
      {title && (
        <div className="bg-gray-700 text-gray-300 text-xs px-4 py-2 rounded-t-lg font-mono flex items-center justify-between">
          <span>{title}</span>
          {language && <span className="text-gray-500">{language}</span>}
        </div>
      )}
      <div className={`relative group bg-[#0D1117] text-gray-300 text-sm font-mono p-4 overflow-x-auto ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400 hover:text-emerald-400 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
        <pre className="leading-relaxed"><code>{highlightCode(code)}</code></pre>
      </div>
    </div>
  )
}
