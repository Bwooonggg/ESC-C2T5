import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Parent Insight ships dark-only for now. progressChart.module.css already had
// dark-mode series colours prepared behind this attribute; this is what turns
// them on. If a light/dark toggle is added later, this becomes the initial
// value of that toggle's state instead of a fixed call.
document.documentElement.dataset.theme = 'dark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
