import React, { useState } from "react";

export function WorksheetPreview({ worksheetData, accessibilitySettings }) {
  const [layoutMode, setLayoutMode] = useState("standard");
  
  const { dyslexiaFont, theme, fontSizePct, lineSpacing, charSpacing } = accessibilitySettings || {
    dyslexiaFont: false,
    theme: "default",
    fontSizePct: 100,
    lineSpacing: 1.5,
    charSpacing: 0
  };

  if (!worksheetData) {
    return (
      <div style={previewStyles.emptyState}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          No activity generated yet. Use the AI Chat Panel to request a literacy exercise for Band A, B, or C (for example, Phonics, Spelling, Grammar, or Reading Comprehension).
        </p>
      </div>
    );
  }

  // Theme Palettes
  const themeStyles = {
    default: { bg: "#ffffff", text: "#1e293b", cardBg: "#f8fafc", border: "#cbd5e1" },
    warm: { bg: "#fdf6e2", text: "#433422", cardBg: "#f5ecd0", border: "#d4c4a8" },
    yellow: { bg: "#ffffcc", text: "#222200", cardBg: "#ffff99", border: "#cccc66" },
    dark: { bg: "#1a1a1a", text: "#f3f4f6", cardBg: "#2d2d2d", border: "#404040" }
  };

  const currentTheme = themeStyles[theme] || themeStyles.default;
  const activeFont = dyslexiaFont ? "'Comic Sans MS', 'Comic Neue', cursive, sans-serif" : "Arial, sans-serif";
  const calculatedFontSize = `${(fontSizePct / 100) * 0.9}rem`;

  return (
    <div className="worksheet-preview-wrapper" style={previewStyles.wrapper}>
      {/* Clean Layout Selection Bar */}
      <div className="worksheet-controls" style={{ ...previewStyles.controlPanel, borderBottomColor: currentTheme.border }}>
        <div style={previewStyles.controlGroup}>
          <span style={{ ...previewStyles.controlLabel, color: currentTheme.text }}>Layout:</span>
          <button 
            onClick={() => setLayoutMode("standard")} 
            style={{ ...previewStyles.layoutBtn, background: layoutMode === "standard" ? '#1e3a8a' : currentTheme.cardBg, color: layoutMode === "standard" ? '#fff' : currentTheme.text }}
          >
            Clean Stack
          </button>
          <button 
            onClick={() => setLayoutMode("cards")} 
            style={{ ...previewStyles.layoutBtn, background: layoutMode === "cards" ? '#1e3a8a' : currentTheme.cardBg, color: layoutMode === "cards" ? '#fff' : currentTheme.text }}
          >
            Spaced Cards
          </button>
          <button 
            onClick={() => setLayoutMode("minimal")} 
            style={{ ...previewStyles.layoutBtn, background: layoutMode === "minimal" ? '#1e3a8a' : currentTheme.cardBg, color: layoutMode === "minimal" ? '#fff' : currentTheme.text }}
          >
            Minimal Focus
          </button>
        </div>
      </div>

      {/* Printable Worksheet Content Container */}
      <div 
        className="worksheet-document"
        style={{ 
          ...previewStyles.document, 
          background: currentTheme.bg,
          color: currentTheme.text,
          fontFamily: activeFont,
          lineHeight: lineSpacing,
          letterSpacing: `${charSpacing}px`
        }}
      >
        <div style={{ ...previewStyles.header, borderBottomColor: currentTheme.border }}>
          <h1 style={{ ...previewStyles.title, fontSize: `calc(${calculatedFontSize} + 0.2rem)`, fontFamily: activeFont, color: currentTheme.text }}>
            {worksheetData.title || "Learning Activity"}
          </h1>
          <p style={{ ...previewStyles.instructions, fontSize: calculatedFontSize, fontFamily: activeFont, color: currentTheme.text, opacity: 0.85, marginBottom: '8px' }}>
            {worksheetData.instructions || "Read carefully and complete each item."}
          </p>

          {/* Reading Passage or Prompt Text Container */}
          {(worksheetData.readingPassage || worksheetData.passage || worksheetData.text || worksheetData.content) && (
            <div style={{ 
              marginTop: '10px', 
              padding: '12px', 
              background: currentTheme.cardBg, 
              border: `1px solid ${currentTheme.border}`, 
              borderRadius: '6px',
              fontSize: calculatedFontSize,
              fontFamily: activeFont,
              lineHeight: lineSpacing
            }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Reading Passage / Context:</strong>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {worksheetData.readingPassage || worksheetData.passage || worksheetData.text || worksheetData.content}
              </p>
            </div>
          )}
        </div>

        {layoutMode === "standard" && (
          <div className="worksheet-items" style={previewStyles.listContainer}>
            {worksheetData.items?.map((item, idx) => (
              <div key={idx} className="worksheet-item" style={{ ...previewStyles.standardItem, background: currentTheme.cardBg, borderColor: currentTheme.border }}>
                <div style={{ ...previewStyles.questionText, fontSize: calculatedFontSize, fontFamily: activeFont, color: currentTheme.text }}>
                  {idx + 1}. {item.question}
                </div>
                {item.options?.length > 0 ? (
                  <div style={previewStyles.optionsRow}>
                    {item.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={opt === item.answer ? "worksheet-option correct-option" : "worksheet-option"}
                        aria-label={opt === item.answer ? `${opt} (correct answer)` : opt}
                        style={{ ...previewStyles.optionBoxNoLetter, fontSize: calculatedFontSize, fontFamily: activeFont, background: currentTheme.bg, borderColor: currentTheme.border, color: currentTheme.text }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="open-ended-answer-space" aria-label="Answer space" style={previewStyles.answerSpace}>
                    {[0, 1, 2].map((line) => (
                      <div key={line} style={{ ...previewStyles.answerLine, borderColor: currentTheme.border }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {layoutMode === "cards" && (
          <div className="worksheet-items" style={previewStyles.cardGrid}>
            {worksheetData.items?.map((item, idx) => (
              <div key={idx} className="worksheet-item" style={{ ...previewStyles.cardItem, background: currentTheme.cardBg, borderColor: currentTheme.border }}>
                <div style={{ ...previewStyles.questionText, fontSize: calculatedFontSize, fontFamily: activeFont, color: currentTheme.text }}>
                  {idx + 1}. {item.question}
                </div>
                {item.options?.length > 0 ? (
                  <div style={previewStyles.optionsColumn}>
                    {item.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={opt === item.answer ? "worksheet-option correct-option" : "worksheet-option"}
                        aria-label={opt === item.answer ? `${opt} (correct answer)` : opt}
                        style={{ ...previewStyles.optionBoxNoLetterCard, fontSize: calculatedFontSize, fontFamily: activeFont, background: currentTheme.bg, borderColor: currentTheme.border, color: currentTheme.text }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="open-ended-answer-space" aria-label="Answer space" style={previewStyles.answerSpace}>
                    {[0, 1, 2].map((line) => (
                      <div key={line} style={{ ...previewStyles.answerLine, borderColor: currentTheme.border }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {layoutMode === "minimal" && (
          <div className="worksheet-items" style={previewStyles.listContainer}>
            {worksheetData.items?.map((item, idx) => (
              <div key={idx} className="worksheet-item" style={{ ...previewStyles.minimalItem, borderBottomColor: currentTheme.border }}>
                <div style={{ ...previewStyles.questionText, fontSize: calculatedFontSize, fontFamily: activeFont, color: currentTheme.text, marginBottom: '6px' }}>
                  {idx + 1}. {item.question}
                </div>
                <div style={{ ...previewStyles.minimalLine, borderColor: currentTheme.border }}></div>
              </div>
            ))}
          </div>
        )}

        <section className="worksheet-answer-key" aria-label="Answer key">
          <h2 style={previewStyles.answerKeyTitle}>Answer Key</h2>
          <div style={previewStyles.answerKeyList}>
            {worksheetData.items?.map((item, idx) => (
              <p key={idx} style={previewStyles.answerKeyItem}>
                <strong>{idx + 1}.</strong> {item.answer}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const previewStyles = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Arial, sans-serif' },
  controlPanel: { display: 'flex', gap: '6px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
  controlGroup: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  controlLabel: { fontSize: '0.8rem', fontWeight: 'bold' },
  layoutBtn: { fontSize: '0.75rem', padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' },
  emptyState: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '2px dashed #cbd5e1', borderRadius: '6px', padding: '16px', textAlign: 'center', background: '#fafafa' },
  document: { flex: 1, padding: '14px', overflowY: 'auto', borderRadius: '6px', border: '1px solid #e2e8f0' },
  header: { marginBottom: '14px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' },
  title: { margin: '0 0 4px 0', fontWeight: '700' },
  instructions: { margin: 0 },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '10px' },
  standardItem: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' },
  questionText: { fontWeight: '600', marginBottom: '8px' },
  optionsRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  optionBoxNoLetter: { flex: 1, minWidth: '70px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '8px' },
  cardItem: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' },
  optionsColumn: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' },
  optionBoxNoLetterCard: { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px' },
  answerSpace: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', padding: '0 2px 4px' },
  answerLine: { height: '20px', borderBottom: '1px solid #cbd5e1' },
  answerKeyTitle: { margin: '0 0 14px', fontSize: '1.25rem' },
  answerKeyList: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' },
  answerKeyItem: { margin: 0, breakInside: 'avoid' },
  minimalItem: { padding: '8px 0', borderBottom: '1px solid #e2e8f0' },
  minimalLine: { height: '28px', borderBottom: '2px dashed #cbd5e1', marginTop: '4px' }
};
