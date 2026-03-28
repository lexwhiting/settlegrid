'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { usePathname } from 'next/navigation'
import { ChatBubble, TypingIndicator } from './chat-bubble'
import { ContactForm } from './contact-form'

const SUGGESTIONS: Record<string, string[]> = {
  '/dashboard': ['How do I create my first tool?', 'How does billing work?', 'How do payouts work?'],
  '/dashboard/tools': ['How do I set pricing for my tool?', 'What is a tool slug?', 'How do I activate my tool?'],
  '/dashboard/analytics': ['How is usage calculated?', 'What does the usage chart show?'],
  '/dashboard/webhooks': ['What webhook events are available?', 'How do I test webhooks?'],
  '/dashboard/payouts': ['When do payouts process?', 'What is the minimum payout?', 'How do I connect Stripe?'],
  '/dashboard/settings': ['How do I update my profile?', 'How does Stripe Connect work?'],
  default: ['What is SettleGrid?', 'How do I get started?', 'What protocols does SettleGrid support?'],
}

function getSuggestions(pathname: string): string[] {
  return SUGGESTIONS[pathname] ?? SUGGESTIONS.default
}

/** Extract plain text from a UIMessage's parts array */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function HelpChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { pageContext: pathname },
    }),
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Focus input when panel opens
  useEffect(() => {
    if (open && !showContactForm) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open, showContactForm])

  // Dismiss on ESC key
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue('')
    sendMessage({ text })
  }, [inputValue, isStreaming, sendMessage])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage({ text: suggestion })
  }, [sendMessage])

  const suggestions = getSuggestions(pathname)

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 ${open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        {/* message-circle icon */}
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      </button>

      {/* Chat panel */}
      <div
        className={`fixed z-[60] transition-all duration-300 ease-out ${
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        } bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[400px] h-full sm:h-[600px] sm:max-h-[calc(100vh-48px)]`}
      >
        <div className="flex flex-col h-full bg-white dark:bg-[#12141F] sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2A2D3E] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-600 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold">SettleGrid Help</h2>
                <p className="text-[11px] text-white/70">AI-powered support</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help chat"
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showContactForm ? (
            /* Contact form view */
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Back to chat
                </button>
              </div>
              <ContactForm
                onClose={() => setShowContactForm(false)}
                pageUrl={typeof window !== 'undefined' ? window.location.href : undefined}
              />
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 ? (
                  /* Empty state with suggestions */
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      How can I help?
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                      Ask me anything about SettleGrid
                    </p>
                    <div className="w-full space-y-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#2A2D3E] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#161822] hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <ChatBubble
                        key={m.id}
                        role={m.role as 'user' | 'assistant'}
                        content={getMessageText(m)}
                      />
                    ))}
                    {status === 'submitted' && (
                      <TypingIndicator />
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="shrink-0 border-t border-gray-200 dark:border-[#2A2D3E] px-4 py-3 bg-white dark:bg-[#12141F]">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your question..."
                    maxLength={1000}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-gray-50 dark:bg-[#161822] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isStreaming}
                    aria-label="Send message"
                    className="w-9 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setShowContactForm(true)}
                  className="mt-2 w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  Prefer email? Contact our support team
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
