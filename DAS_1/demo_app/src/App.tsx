import React, { useState } from 'react'
import type { ScreenerType } from '../shared/types'
import ScreenerPage from './pages/ScreenerPage'
import HomeView from './views/HomeView'
import AccessibilityToolbar from './components/AccessibilityToolbar' 
import './App.css'

export function App() {
  const [selectedScreener, setSelectedScreener] = useState<ScreenerType | null>(null)

  return (
    <div className="app-container">
      {/* Floating Accessibility Controls */}
      <AccessibilityToolbar />

      {selectedScreener === null ? (
        <HomeView onSelectScreener={(type) => setSelectedScreener(type)} />
      ) : (
        <div>
          <button
            type="button"
            className="back-btn"
            onClick={() => setSelectedScreener(null)}
          >
            ← Back to Home
          </button>
          <ScreenerPage screenerType={selectedScreener} />
        </div>
      )}
    </div>
  )
}

export default App