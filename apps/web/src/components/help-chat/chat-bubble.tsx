'use client'

import ReactMarkdown from 'react-markdown'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="bg-gray-100 dark:bg-[#1E2030] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ role, content, timestamp }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''} max-w-[85%] ${isUser ? 'ml-auto' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}
      <div>
        <div
          className={
            isUser
              ? 'bg-amber-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5'
              : 'bg-gray-100 dark:bg-[#1E2030] text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5'
          }
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:bg-gray-200 prose-pre:dark:bg-[#151726] prose-pre:rounded-lg prose-pre:text-xs prose-code:text-xs prose-code:bg-gray-200 prose-code:dark:bg-[#151726] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        {timestamp && (
          <p className={`text-[10px] mt-1 ${isUser ? 'text-right' : ''} text-gray-400 dark:text-gray-500`}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}

export { ChatBubble, TypingIndicator }
export type { ChatBubbleProps }
