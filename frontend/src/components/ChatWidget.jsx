import { useState, useEffect, useRef } from 'react'
import { sendChatMessage, getChatHistory, clearChatHistory } from '../api'

// ══════════════════════════════════════════════════════
// ChatWidget.jsx — Floating AI Finance Assistant
//
// Features:
//  • Floating 🤖 button fixed at bottom-right
//  • Chat panel slides up on click
//  • 🎤 Voice input  — Web Speech API (no packages needed)
//  • ➕ File/Image   — attach images, CSVs, text files
//  • Persistent chat history stored in DB
// ══════════════════════════════════════════════════════

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What is my total balance?",
  "Am I over budget anywhere?",
  "Top spending categories?",
]

// File type → icon + label
function getFileIcon(type) {
  if (type.startsWith('image/'))        return { icon: '🖼️', label: 'Image' }
  if (type === 'application/pdf')       return { icon: '📄', label: 'PDF' }
  if (type === 'text/csv' || type.includes('csv')) return { icon: '📊', label: 'CSV' }
  if (type.startsWith('text/'))         return { icon: '📝', label: 'Text' }
  return { icon: '📎', label: 'File' }
}

export default function ChatWidget() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [unread, setUnread]       = useState(0)

  // ── Voice state ──────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [micError, setMicError]       = useState('')
  const recognitionRef = useRef(null)

  // ── File attachment state ─────────────────────────────
  // { name, type, preview (dataURL for images), content (text/csv), size }
  const [attachment, setAttachment] = useState(null)
  const fileInputRef = useRef(null)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Load history on first open
  useEffect(() => {
    if (open && !loaded) {
      getChatHistory().then(data => {
        if (data) setMessages(data)
        setLoaded(true)
      })
    }
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Stop recording when panel closes
  useEffect(() => {
    if (!open && isRecording) stopRecording()
  }, [open])

  // ══════════════════════════════════════════════════════
  // VOICE INPUT — Web Speech API (Chrome / Edge / Safari)
  // ══════════════════════════════════════════════════════
  function startRecording() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMicError('Voice input is not supported in this browser. Please use Chrome or Edge.')
      setTimeout(() => setMicError(''), 3500)
      return
    }

    const rec = new SpeechRecognition()
    rec.lang            = 'en-IN'   // works for English with Indian accent
    rec.continuous      = true      // keep recording until stopped
    rec.interimResults  = true      // show partial transcript while speaking

    rec.onstart = () => {
      setIsRecording(true)
      setMicError('')
    }

    rec.onresult = (event) => {
      // Collect all results (interim + final) into one string
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      // Replace the current input with the live transcript
      setInput(transcript)
    }

    rec.onerror = (event) => {
      setIsRecording(false)
      if (event.error === 'not-allowed') {
        setMicError('Microphone access denied. Please allow mic permission in your browser.')
      } else if (event.error === 'no-speech') {
        setMicError('No speech detected. Try again.')
      } else {
        setMicError(`Voice error: ${event.error}`)
      }
      setTimeout(() => setMicError(''), 3500)
    }

    rec.onend = () => setIsRecording(false)

    recognitionRef.current = rec
    rec.start()
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
  }

  function toggleMic() {
    if (isRecording) stopRecording()
    else startRecording()
  }

  // ══════════════════════════════════════════════════════
  // FILE / IMAGE ATTACHMENT
  // ══════════════════════════════════════════════════════
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5 MB.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()

    if (file.type.startsWith('image/')) {
      // Read as base64 data URL so we can show a preview
      reader.onload = ev => {
        setAttachment({
          name: file.name,
          type: file.type,
          preview: ev.target.result,   // data:image/...;base64,...
          size: file.size
        })
      }
      reader.readAsDataURL(file)

    } else if (
      file.type === 'text/csv' ||
      file.type === 'text/plain' ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.txt')
    ) {
      // Read as text so Gemini can analyse the content
      reader.onload = ev => {
        setAttachment({
          name: file.name,
          type: file.type || 'text/plain',
          content: ev.target.result.slice(0, 3000), // cap at 3000 chars
          size: file.size
        })
      }
      reader.readAsText(file)

    } else {
      // PDF, docx, etc. — just store the name, can't read content in browser
      setAttachment({ name: file.name, type: file.type, size: file.size })
    }

    // Reset so the same file can be re-attached after removal
    e.target.value = ''
  }

  function removeAttachment() {
    setAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ══════════════════════════════════════════════════════
  // SEND MESSAGE
  // ══════════════════════════════════════════════════════
  async function handleSend(quickText) {
    const text = (quickText || input).trim()
    if ((!text && !attachment) || loading) return

    // Build the message string that goes to Gemini
    // For text/CSV files, we include the file content so Gemini can read it
    let fullMessage = text

    if (attachment) {
      if (attachment.preview) {
        // Image
        fullMessage = text
          ? `${text}\n\n[User also attached an image: "${attachment.name}"]`
          : `[User attached an image: "${attachment.name}"]`
      } else if (attachment.content) {
        // Text / CSV — include the content for Gemini to analyse
        fullMessage = text
          ? `${text}\n\n[Attached file: "${attachment.name}"]\n${attachment.content}`
          : `Please analyse this file content:\n\n[File: "${attachment.name}"]\n${attachment.content}`
      } else {
        // PDF / unknown
        fullMessage = text
          ? `${text}\n\n[User attached a file: "${attachment.name}"]`
          : `[User attached a file: "${attachment.name}"]`
      }
    }

    // Show the user bubble immediately (optimistic)
    const userMsg = {
      role: 'user',
      content: text || `📎 ${attachment.name}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: attachment ? { ...attachment } : null
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachment(null)
    setLoading(true)
    if (isRecording) stopRecording()
    inputRef.current?.focus()

    // Call the RAG backend
    const data = await sendChatMessage(fullMessage)
    setLoading(false)

    const reply = data?.reply ||
      'Sorry, I could not get a response. Please check your Gemini API key in backend/main.py.'

    const botMsg = {
      role: 'assistant',
      content: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, botMsg])

    if (!open) setUnread(n => n + 1)
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

  const canSend = (input.trim() || attachment) && !loading

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <>
      {/* ── CHAT PANEL ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 24,
          width: 375, height: 540,
          background: '#0f0f2e', border: '1px solid #2a2a5a',
          borderRadius: 16, zIndex: 9998,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(233,69,96,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'widgetSlideUp 0.22s ease'
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 15px', flexShrink: 0,
            background: 'linear-gradient(135deg,#1a1a3e,#12122e)',
            borderBottom: '1px solid #2a2a5a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', fontSize: 18,
                background: 'linear-gradient(135deg,#e94560,#c62a47)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 10px rgba(233,69,96,0.4)'
              }}>🤖</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                  AI Finance Assistant
                </div>
                <div style={{ color: '#4CAF50', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
                  Local AI · Voice · Files
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {messages.length > 0 && (
                <button onClick={handleClear} title="Clear chat" style={iconBtnStyle}>🗑</button>
              )}
              <button onClick={() => setOpen(false)} title="Close" style={iconBtnStyle}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 13px 6px',
            display: 'flex', flexDirection: 'column', gap: 11
          }}>

            {/* Welcome screen */}
            {!loading && messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 4px' }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
                <p style={{ color: '#888', fontSize: 13, margin: '0 0 14px' }}>
                  Ask me anything — type, speak, or attach a file
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => handleSend(s)}
                      style={{
                        background: '#1a1a3e', border: '1px solid #2a2a5a',
                        color: '#aaa', padding: '8px 11px', borderRadius: 8,
                        cursor: 'pointer', fontSize: 12, textAlign: 'left',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='#e94560'; e.currentTarget.style.color='#fff' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='#2a2a5a'; e.currentTarget.style.color='#aaa' }}
                    >💬 {s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 7
              }}>
                {/* Avatar */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#e94560,#c62a47)' : '#1a1a3e',
                  border: msg.role === 'assistant' ? '1px solid #2a2a5a' : 'none'
                }}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#e94560,#c62a47)' : '#1a1a3e',
                  color: '#fff',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user'
                    ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  border: msg.role === 'assistant' ? '1px solid #2a2a5a' : 'none',
                  fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {/* Image preview inside bubble */}
                  {msg.attachment?.preview && (
                    <img
                      src={msg.attachment.preview}
                      alt={msg.attachment.name}
                      style={{
                        maxWidth: '100%', maxHeight: 140, borderRadius: 8,
                        display: 'block', marginBottom: msg.content ? 6 : 0,
                        border: '1px solid rgba(255,255,255,0.15)'
                      }}
                    />
                  )}
                  {/* Non-image file card inside bubble */}
                  {msg.attachment && !msg.attachment.preview && (
                    <div style={{
                      background: 'rgba(0,0,0,0.2)', borderRadius: 8,
                      padding: '7px 10px', marginBottom: msg.content ? 6 : 0,
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12
                    }}>
                      <span style={{ fontSize: 18 }}>
                        {getFileIcon(msg.attachment.type).icon}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{msg.attachment.name}</div>
                        <div style={{ opacity: 0.6, fontSize: 10 }}>
                          {getFileIcon(msg.attachment.type).label} ·{' '}
                          {(msg.attachment.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                  )}
                  {msg.content}
                  <div style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.35)',
                    marginTop: 4, textAlign: 'right'
                  }}>{msg.time}</div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#1a1a3e', border: '1px solid #2a2a5a'
                }}>🤖</div>
                <div style={{
                  background: '#1a1a3e', border: '1px solid #2a2a5a',
                  padding: '10px 14px', borderRadius: '14px 14px 14px 3px',
                  display: 'flex', gap: 4, alignItems: 'center'
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#e94560',
                      animation: 'widgetBounce 1.2s infinite ease-in-out',
                      animationDelay: `${i * 0.2}s`
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── INPUT AREA ── */}
          <div style={{
            flexShrink: 0, padding: '8px 12px 12px',
            borderTop: '1px solid #1a1a3e', background: '#0a0a20'
          }}>

            {/* Mic error toast */}
            {micError && (
              <div style={{
                background: '#3a1a1a', border: '1px solid #e94560',
                color: '#ff9999', fontSize: 11, padding: '6px 10px',
                borderRadius: 8, marginBottom: 8, lineHeight: 1.4
              }}>⚠️ {micError}</div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.3)',
                borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 12
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#e94560',
                  animation: 'micPulse 1s infinite', display: 'inline-block'
                }} />
                <span style={{ color: '#e94560', fontWeight: 600 }}>Recording...</span>
                <span style={{ color: '#888' }}>Speak now · tap mic to stop</span>
              </div>
            )}

            {/* File attachment preview */}
            {attachment && (
              <div style={{
                background: '#1a1a3e', border: '1px solid #2a2a5a',
                borderRadius: 10, padding: '8px 10px', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                {/* Image thumbnail */}
                {attachment.preview ? (
                  <img src={attachment.preview} alt=""
                    style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: 6, background: '#2a2a5a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0
                  }}>
                    {getFileIcon(attachment.type).icon}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {attachment.name}
                  </div>
                  <div style={{ color: '#888', fontSize: 10 }}>
                    {getFileIcon(attachment.type).label} · {(attachment.size / 1024).toFixed(1)} KB
                    {attachment.content && ' · content will be sent to AI'}
                  </div>
                </div>
                <button onClick={removeAttachment}
                  style={{
                    background: 'none', border: 'none', color: '#888',
                    fontSize: 18, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: '50%'
                  }}
                  title="Remove attachment"
                >✕</button>
              </div>
            )}

            {/* Input row: [+] [input field] [🎤] [➤] */}
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.csv,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Plus button — opens file picker */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Attach file or image"
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  flexShrink: 0, fontSize: 20, fontWeight: 300,
                  background: attachment ? 'linear-gradient(135deg,#4CAF50,#388E3C)' : '#1a1a3e',
                  border: `1px solid ${attachment ? '#4CAF50' : '#2a2a5a'}`,
                  color: attachment ? '#fff' : '#888',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: attachment ? '0 0 10px rgba(76,175,80,0.3)' : 'none'
                }}
                onMouseEnter={e => { if (!loading && !attachment) { e.currentTarget.style.background='#2a2a5a'; e.currentTarget.style.color='#fff' }}}
                onMouseLeave={e => { if (!attachment) { e.currentTarget.style.background='#1a1a3e'; e.currentTarget.style.color='#888' }}}
              >
                {attachment ? '✓' : '+'}
              </button>

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? '🎤 Listening...'
                    : attachment
                    ? 'Add a message (optional)...'
                    : 'Ask about your finances...'
                }
                disabled={loading}
                style={{
                  flex: 1,
                  background: isRecording ? 'rgba(233,69,96,0.08)' : '#1a1a3e',
                  border: `1px solid ${isRecording ? '#e94560' : '#2a2a5a'}`,
                  color: '#fff', padding: '9px 13px',
                  borderRadius: 22, fontSize: 13, outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={e => { if (!isRecording) e.target.style.borderColor = '#e94560' }}
                onBlur={e => { if (!isRecording) e.target.style.borderColor = '#2a2a5a' }}
              />

              {/* Mic button */}
              <button
                onClick={toggleMic}
                disabled={loading}
                title={isRecording ? 'Stop recording' : 'Voice input'}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  flexShrink: 0, fontSize: 16,
                  background: isRecording
                    ? 'linear-gradient(135deg,#e94560,#c62a47)'
                    : '#1a1a3e',
                  border: `1px solid ${isRecording ? '#e94560' : '#2a2a5a'}`,
                  color: isRecording ? '#fff' : '#888',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isRecording ? '0 0 14px rgba(233,69,96,0.5)' : 'none',
                  animation: isRecording ? 'micPulse 1.5s infinite' : 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!loading && !isRecording) { e.currentTarget.style.background='#2a2a5a'; e.currentTarget.style.color='#fff' }}}
                onMouseLeave={e => { if (!isRecording) { e.currentTarget.style.background='#1a1a3e'; e.currentTarget.style.color='#888' }}}
              >
                {isRecording ? '⏹' : '🎤'}
              </button>

              {/* Send button */}
              <button
                onClick={() => handleSend()}
                disabled={!canSend}
                title="Send"
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  flexShrink: 0, fontSize: 14,
                  background: canSend
                    ? 'linear-gradient(135deg,#e94560,#c62a47)' : '#2a2a5a',
                  color: '#fff',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: canSend ? '0 0 12px rgba(233,69,96,0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
              >➤</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING BUTTON ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="AI Finance Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          border: 'none', zIndex: 9999, cursor: 'pointer',
          background: open ? '#2a2a5a' : 'linear-gradient(135deg,#e94560,#c62a47)',
          color: '#fff', fontSize: open ? 22 : 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open
            ? '0 4px 20px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(233,69,96,0.5), 0 0 0 4px rgba(233,69,96,0.15)',
          transition: 'all 0.25s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {open ? '✕' : '🤖'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#4CAF50', color: '#fff',
            width: 20, height: 20, borderRadius: '50%',
            fontSize: 11, fontWeight: 'bold', border: '2px solid #0f0f2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unread}</span>
        )}
      </button>

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes widgetSlideUp {
          from { opacity:0; transform:translateY(20px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes widgetBounce {
          0%,60%,100% { transform:translateY(0); }
          30%          { transform:translateY(-6px); }
        }
        @keyframes micPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(233,69,96,0.5); }
          50%     { box-shadow: 0 0 0 8px rgba(233,69,96,0); }
        }
      `}</style>
    </>
  )
}

// Shared style for small icon buttons in the header
const iconBtnStyle = {
  background: 'none', border: '1px solid #2a2a5a',
  color: '#888', width: 28, height: 28, borderRadius: 6,
  cursor: 'pointer', fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}
