import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import DevLogView from './DevLogView'
import './index.css'

// Apply the saved theme before first paint (covers the dev-log popup too).
// Default to the e-ink-friendly high-contrast theme.
document.documentElement.dataset.theme = localStorage.getItem('mahlah.theme') || 'eink'

const view = new URLSearchParams(window.location.search).get('view')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view === 'devlog' ? <DevLogView /> : <App />}</React.StrictMode>,
)
