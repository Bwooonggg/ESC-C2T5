import React, { useState, useEffect } from 'react'
import './AccessibilityToolbar.css'

export function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false)

  // Accessibility State Defaults
  const [fontSize, setFontSize] = useState<number>(100)
  const [letterSpacing, setLetterSpacing] = useState<number>(0)
  const [lineHeight, setLineHeight] = useState<number>(1.5)
  const [theme, setTheme] = useState<'default' | 'cream' | 'dark' | 'yellow'>('default')
  const [dyslexicFont, setDyslexicFont] = useState<boolean>(false)

  // Inject OpenDyslexic font link dynamically
  useEffect(() => {
    const fontId = 'opendyslexic-font-link'
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link')
      link.id = fontId
      link.rel = 'stylesheet'
      link.href = 'https://fonts.cdnfonts.com/css/opendyslexic'
      document.head.appendChild(link)
    }
  }, [])

  // Update CSS Custom Variables
  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--app-font-scale', `${fontSize}%`)
    root.style.setProperty('--app-letter-spacing', `${letterSpacing}px`)
    root.style.setProperty('--app-line-height', `${lineHeight}`)
    root.style.fontSize = `${fontSize}%`

    if (theme === 'cream') {
      root.style.setProperty('--das-bg', '#fbf9f1')
      root.style.setProperty('--das-card', '#f3efe0')
      root.style.setProperty('--das-text', '#2c2c2c')
    } else if (theme === 'yellow') {
      root.style.setProperty('--das-bg', '#ffffcc')
      root.style.setProperty('--das-card', '#ffff99')
      root.style.setProperty('--das-text', '#000000')
    } else if (theme === 'dark') {
      root.style.setProperty('--das-bg', '#0f172a')
      root.style.setProperty('--das-card', '#1e293b')
      root.style.setProperty('--das-text', '#f8fafc')
    } else {
      root.style.setProperty('--das-bg', '#f8fafc')
      root.style.setProperty('--das-card', '#ffffff')
      root.style.setProperty('--das-text', '#0f172a')
    }

    if (dyslexicFont) {
      root.style.setProperty('--app-font-family', "'OpenDyslexic', 'Comic Sans MS', sans-serif")
    } else {
      root.style.setProperty('--app-font-family', "Inter, system-ui, -apple-system, sans-serif")
    }
  }, [fontSize, letterSpacing, lineHeight, theme, dyslexicFont])

  const handleReset = () => {
    setFontSize(100)
    setLetterSpacing(0)
    setLineHeight(1.5)
    setTheme('default')
    setDyslexicFont(false)
  }

  return (
    <>
      <button 
        type="button" 
        className="a11y-trigger-btn"
        onClick={() => setIsOpen(true)}
      >
        ⚙️ Reading Settings
      </button>

      {isOpen && (
        <div className="a11y-overlay" onClick={() => setIsOpen(false)}>
          <div className="a11y-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="a11y-header">
              <h2>Accessibility Settings</h2>
              <button 
                type="button" 
                className="a11y-close-btn"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Font Toggle */}
            <div className="a11y-section">
              <label>Dyslexia-Friendly Font</label>
              <div className="a11y-btn-group">
                <button
                  type="button"
                  className={`a11y-opt-btn ${dyslexicFont ? 'active' : ''}`}
                  onClick={() => setDyslexicFont(!dyslexicFont)}
                >
                  {dyslexicFont ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Theme / High-Contrast Options */}
            <div className="a11y-section">
              <label>Contrast & Overlay Theme</label>
              <div className="a11y-btn-group">
                <button
                  type="button"
                  className={`a11y-opt-btn ${theme === 'default' ? 'active' : ''}`}
                  onClick={() => setTheme('default')}
                >
                  Default
                </button>
                <button
                  type="button"
                  className={`a11y-opt-btn ${theme === 'cream' ? 'active' : ''}`}
                  onClick={() => setTheme('cream')}
                >
                  Warm
                </button>
                <button
                  type="button"
                  className={`a11y-opt-btn ${theme === 'yellow' ? 'active' : ''}`}
                  onClick={() => setTheme('yellow')}
                >
                  Yellow
                </button>
                <button
                  type="button"
                  className={`a11y-opt-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Editable Font Size */}
            <div className="a11y-section">
              <label>Font Size (%)</label>
              <div className="a11y-control-row">
                <input
                  type="range"
                  min="80"
                  max="160"
                  value={fontSize}
                  className="a11y-slider"
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
                <input
                  type="number"
                  min="80"
                  max="200"
                  value={fontSize}
                  className="a11y-num-input"
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Editable Line Height */}
            <div className="a11y-section">
              <label>Line Spacing (Multiplier)</label>
              <div className="a11y-control-row">
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.1"
                  value={lineHeight}
                  className="a11y-slider"
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                />
                <input
                  type="number"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  value={lineHeight}
                  className="a11y-num-input"
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Editable Letter Spacing */}
            <div className="a11y-section">
              <label>Character Spacing (px)</label>
              <div className="a11y-control-row">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={letterSpacing}
                  className="a11y-slider"
                  onChange={(e) => setLetterSpacing(Number(e.target.value))}
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={letterSpacing}
                  className="a11y-num-input"
                  onChange={(e) => setLetterSpacing(Number(e.target.value))}
                />
              </div>
            </div>

            <button type="button" className="a11y-reset-btn" onClick={handleReset}>
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default AccessibilityToolbar