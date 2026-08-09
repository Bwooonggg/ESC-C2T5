import React from 'react';
import { panelStyles } from './source/styles/PanelStyles';

export function AccessibilityModal({
  showAccessModal,
  setShowAccessModal,
  dyslexiaFont,
  setDyslexiaFont,
  theme,
  setTheme,
  fontSizePct,
  setFontSizePct,
  lineSpacing,
  setLineSpacing,
  charSpacing,
  setCharSpacing,
  handleResetDefaults
}) {
  return (
    <div className="access-floating-widget" style={panelStyles.floatingWrapper}>
      {showAccessModal && (
        <div style={panelStyles.modalCard}>
          <div style={panelStyles.modalHeader}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Accessibility Settings</h3>
            <button onClick={() => setShowAccessModal(false)} style={panelStyles.closeXBtn}>✕</button>
          </div>

          <div style={panelStyles.settingSection}>
            <label style={panelStyles.settingTitle}>Dyslexia-Friendly Font</label>
            <div style={panelStyles.segmentedControl}>
              <button 
                onClick={() => setDyslexiaFont(false)} 
                style={{ ...panelStyles.segmentBtn, background: !dyslexiaFont ? '#334155' : '#f1f5f9', color: !dyslexiaFont ? '#fff' : '#64748b' }}
              >
                Disabled
              </button>
              <button 
                onClick={() => setDyslexiaFont(true)} 
                style={{ ...panelStyles.segmentBtn, background: dyslexiaFont ? '#1e3a8a' : '#f1f5f9', color: dyslexiaFont ? '#fff' : '#64748b' }}
              >
                Enabled
              </button>
            </div>
          </div>

          <div style={panelStyles.settingSection}>
            <label style={panelStyles.settingTitle}>Contrast &amp; Overlay Theme</label>
            <div style={panelStyles.themeGrid}>
              {['default', 'warm', 'yellow', 'dark'].map((tKey) => (
                <button
                  key={tKey}
                  onClick={() => setTheme(tKey)}
                  style={{
                    ...panelStyles.themeBtn,
                    border: theme === tKey ? '2px solid #1e3a8a' : '1px solid #cbd5e1',
                    background: tKey === 'default' ? '#fff' : tKey === 'warm' ? '#fdf6e2' : tKey === 'yellow' ? '#ffffcc' : '#1a1a1a',
                    color: tKey === 'dark' ? '#fff' : '#1e293b'
                  }}
                >
                  {tKey.charAt(0).toUpperCase() + tKey.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={panelStyles.settingSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={panelStyles.settingTitle}>Font Size (%)</label>
              <input 
                type="number" min="80" max="180" value={fontSizePct} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) setFontSizePct(val);
                }}
                style={{ width: '50px', fontSize: '0.8rem', padding: '2px 4px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <input 
              type="range" min="80" max="180" value={fontSizePct} 
              onChange={(e) => setFontSizePct(Number(e.target.value))}
              style={panelStyles.rangeInput}
            />
          </div>

          <div style={panelStyles.settingSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={panelStyles.settingTitle}>Line Spacing</label>
              <input 
                type="number" min="1.0" max="3.0" step="0.1" value={lineSpacing} 
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setLineSpacing(val);
                }}
                style={{ width: '50px', fontSize: '0.8rem', padding: '2px 4px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <input 
              type="range" min="1.0" max="3.0" step="0.1" value={lineSpacing} 
              onChange={(e) => setLineSpacing(Number(e.target.value))}
              style={panelStyles.rangeInput}
            />
          </div>

          <div style={panelStyles.settingSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={panelStyles.settingTitle}>Character Spacing (px)</label>
              <input 
                type="number" min="0" max="10" value={charSpacing} 
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setCharSpacing(val);
                }}
                style={{ width: '50px', fontSize: '0.8rem', padding: '2px 4px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <input 
              type="range" min="0" max="10" value={charSpacing} 
              onChange={(e) => setCharSpacing(Number(e.target.value))}
              style={panelStyles.rangeInput}
            />
          </div>

          <button onClick={handleResetDefaults} style={panelStyles.resetBtn}>
            Reset to Defaults
          </button>
        </div>
      )}

      <button 
        onClick={() => setShowAccessModal(!showAccessModal)} 
        style={panelStyles.floatingTriggerBtn}
      >
        ⚙️ Accessibility Settings
      </button>
    </div>
  );
}