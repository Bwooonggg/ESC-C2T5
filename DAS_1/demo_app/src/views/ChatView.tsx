import React, { useState } from 'react'
import './ChatView.css'

interface ChatViewProps {
  title?: string
  messages?: Array<{ role: string; content: string }>
  placeholder?: string
  disabled?: boolean
  onSend: (message: string) => void
}

export default function ChatView({
  title = '',
  messages = [],
  placeholder = '',
  disabled = false,
  onSend,
}: ChatViewProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
  }

  const isChildScreener = Boolean(title && title.toLowerCase().includes('child'))

  // Dynamic fallback greeting based on screener type
  const defaultGreeting = isChildScreener
    ? 'Hello! Welcome to the child screener. Please describe what you have noticed about the child’s reading, writing, or learning experiences.'
    : 'Hello! Welcome to the adult screener. Please describe any reading, writing, or learning difficulties you experience.'

  const displayMessages =
    messages && messages.length > 0
      ? messages
      : [
          {
            role: 'assistant',
            content: defaultGreeting,
          },
        ]

  return (
    <div
      className="screener-page-container"
      style={{
        maxWidth: '1100px',
        height: 'calc(100vh - 140px)',
        maxHeight: '750px',
        margin: '1rem auto',
        padding: '2rem',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {title ? (
        <h1
          className="screener-header-title"
          style={{
            fontSize: '2.25rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1rem',
            marginTop: 0,
          }}
        >
          {title}
        </h1>
      ) : null}

      <div
        className="chat-window"
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {displayMessages.map((msg, idx) => {
          const isAssistant = msg.role === 'assistant'
          return (
            <div
              key={idx}
              className={isAssistant ? 'assistant-box' : 'user-box'}
              style={{
                alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                backgroundColor: isAssistant ? '#ffffff' : '#1e3a8a',
                color: isAssistant ? '#1e293b' : '#ffffff',
                border: isAssistant ? '1px solid #cbd5e1' : 'none',
                borderRadius: isAssistant ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                padding: '1.25rem 1.5rem',
                fontSize: '1.15rem',
                lineHeight: '1.6',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
              }}
            >
              <span
                className="role"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.4rem',
                  color: isAssistant ? '#2563eb' : '#93c5fd',
                }}
              >
                {isAssistant ? 'Assistant' : 'You'}
              </span>
              <div className="message">{msg.content}</div>
            </div>
          )
        })}
      </div>

      <form
        className="input-container"
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        <input
          className="custom-chat-input"
          type="text"
          placeholder={placeholder}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            padding: '1.1rem 1.25rem',
            fontSize: '1.15rem',
            border: '2px solid #cbd5e1',
            borderRadius: '8px',
            outline: 'none',
            backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
            transition: 'border-color 0.2s ease',
          }}
        />
        <button
          className="custom-send-btn"
          type="submit"
          disabled={disabled}
          style={{
            padding: '1.1rem 2.25rem',
            fontSize: '1.15rem',
            fontWeight: '600',
            color: '#ffffff',
            backgroundColor: disabled ? '#94a3b8' : '#1e3a8a',
            border: 'none',
            borderRadius: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}