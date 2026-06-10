import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { sendChatMessage, getChatHistory, clearChatHistory } from '../api'

// ══════════════════════════════════════════════════════
// Chat.jsx — AI Finance Assistant powered by RAG + Gemini
//
// Flow:
//   User types question → sent to POST /chat
//   Backend retrieves user's DB data (RAG retrieval)
//   Gemini reads data + answers (RAG generation)
//   Reply displayed in chat bubble
// ══════════════════════════════════════════════════════

// Suggested questions shown when chat is empty
const SUGGESTIONS = [
  "How much did I spend this month?",
  "What is my total balance?",
  "Am I over budget anywhere?",
  "What are my top spending categories?",
  "How much did I save this month?",
  "Show me my recent transactions",
]

export default function Chat() {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Load existing chat history when page opens
  useEffect(() => {
    loadHistory()
  }, [])

  // Auto-scroll to the latest message every time messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function loadHistory() {
    const data = await getChatHistory()
    if (data) setMessages(data)
    setPageLoading(false)
  }

  // Send a message (from input box or suggestion chip click)
  async function handleSend(text) {
    const question = (text || input).trim()
    if (!question || loading) return

    // Show user's message immediately (optimistic UI)
    const userMsg = {
      role: 'user',
      content: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    // Call the RAG backend
    const data = await sendChatMessage(question)
    setLoading(false)

    if (data?.reply) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I could not get a response. Please check the backend and your Gemini API key.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    }
  }

  async function handleClear() {
    if (!confirm('Clear all chat history?')) return
    await clearChatHistory()
    setMessages([])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="main-content" style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', padding: 0
      }}>

        {/* ── Top bar ── */}
        <div className="topbar" style={{ flexShrink: 0, padding: '0 24px' }}>
          <div>
            <h1 style={{ margin: 0 }}>🤖 AI Finance Assistant</h1>
            <p style={{ margin: 0, color: '#888', fontSize: 12, marginTop: 2 }}>
              Powered by Gemini AI + RAG · Answers from your real financial data
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: '1px solid #2a2a5a',
                color: '#888', padding: '6px 14px', borderRadius: 8,
                cursor: 'pointer', fontSize: 12
              }}
            >
              🗑 Clear Chat
            </button>
          )}
        </div>

        {/* ── Messages area ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 16
        }}>

          {/* Welcome screen shown when no messages exist */}
          {!pageLoading && messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🤖</div>
              <h2 style={{ color: '#e0e0e0', margin: '0 0 8px' }}>
                Hi! I'm your Finance Assistant
              </h2>
              <p style={{ color: '#888', margin: '0 0 28px', fontSize: 14 }}>
                Ask me anything about your money — I read your real transaction data to answer.
              </p>

              {/* Suggestion chips */}
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                gap: 10, justifyContent: 'center', maxWidth: 560, margin: '0 auto'
              }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    style={{
                      background: '#1a1a3e', border: '1px solid #2a2a5a',
                      color: '#aaa', padding: '9px 16px', borderRadius: 20,
                      cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#2a2a5a'
                      e.currentTarget.style.color = '#fff'
                      e.currentTarget.style.borderColor = '#e94560'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#1a1a3e'
                      e.currentTarget.style.color = '#aaa'
                      e.currentTarget.style.borderColor = '#2a2a5a'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat message bubbles */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 10
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 'bold',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg,#e94560,#c62a47)'
                  : '#1a1a3e',
                border: msg.role === 'assistant' ? '1px solid #2a2a5a' : 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}>
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '72%',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg,#e94560,#c62a47)'
                  : '#1a1a3e',
                color: '#fff',
                padding: '11px 15px',
                borderRadius: msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                border: msg.role === 'assistant' ? '1px solid #2a2a5a' : 'none',
                lineHeight: 1.65,
                fontSize: 14,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}>
                {msg.content}
                <div style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.4)',
                  marginTop: 5, textAlign: 'right'
                }}>
                  {msg.time}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator while waiting for AI response */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#1a1a3e', border: '1px solid #2a2a5a', fontSize: 16
              }}>
                🤖
              </div>
              <div style={{
                background: '#1a1a3e', border: '1px solid #2a2a5a',
                padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
                display: 'flex', gap: 5, alignItems: 'center'
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#e94560',
                    animation: 'chatBounce 1.2s infinite ease-in-out',
                    animationDelay: `${i * 0.2}s`
                  }} />
                ))}
                <span style={{ color: '#666', fontSize: 12, marginLeft: 6 }}>
                  Analysing your finances...
                </span>
              </div>
            </div>
          )}

          {/* Invisible div to scroll into view */}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar at the bottom ── */}
        <div style={{
          flexShrink: 0, padding: '14px 24px 18px',
          borderTop: '1px solid #1a1a3e',
          background: '#0f0f2e'
        }}>
          {/* Quick suggestion chips above input (only when there are messages) */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={loading}
                  style={{
                    background: '#1a1a3e', border: '1px solid #2a2a5a',
                    color: '#777', padding: '5px 12px', borderRadius: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 11, transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.borderColor = '#e94560'
                      e.currentTarget.style.color = '#fff'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2a2a5a'
                    e.currentTarget.style.color = '#777'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={e => { e.preventDefault(); handleSend() }}
            style={{ display: 'flex', gap: 10, alignItems: 'center' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances... e.g. How much did I spend on food?"
              disabled={loading}
              style={{
                flex: 1,
                background: '#1a1a3e',
                border: '1px solid #2a2a5a',
                color: '#fff',
                padding: '13px 18px',
                borderRadius: 28,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#e94560'}
              onBlur={e => e.target.style.borderColor = '#2a2a5a'}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                border: 'none', flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg,#e94560,#c62a47)'
                  : '#2a2a5a',
                color: '#fff',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
                boxShadow: input.trim() && !loading
                  ? '0 0 14px rgba(233,69,96,0.4)' : 'none'
              }}
            >
              ➤
            </button>
          </form>
        </div>
      </main>

      {/* Bouncing dots animation for the typing indicator */}
      <style>{`
        @keyframes chatBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  )
}
