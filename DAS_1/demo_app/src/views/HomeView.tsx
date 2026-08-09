import React from 'react'
import './HomeView.css'

interface HomeViewProps {
  onSelectScreener: (type: 'adult' | 'child') => void
}

export function HomeView({ onSelectScreener }: HomeViewProps) {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="home-title">Dyslexia Association of Singapore Screener</h1>
        <p className="home-subtitle">
          Select a screening tool below to begin an interactive self-assessment and explore recommended support pathways.
        </p>
      </header>

      <div className="screener-card-grid">
        <div className="screener-card" onClick={() => onSelectScreener('adult')}>
          <div className="card-content">
            <h2 className="card-title">Adult Screener</h2>
            <p className="card-description">
              Designed for adults experiencing reading, writing, spelling, or workplace organization difficulties.
            </p>
          </div>
          <button type="button" className="card-btn">
            Start Adult Screener
          </button>
        </div>

        <div className="screener-card" onClick={() => onSelectScreener('child')}>
          <div className="card-content">
            <h2 className="card-title">Child Screener</h2>
            <p className="card-description">
              Designed for parents and educators to assess early signs of learning differences in school-aged children.
            </p>
          </div>
          <button type="button" className="card-btn">
            Start Child Screener
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomeView