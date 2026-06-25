import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import DevLogView from './DevLogView'
import './index.css'

const view = new URLSearchParams(window.location.search).get('view')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view === 'devlog' ? <DevLogView /> : <App />}</React.StrictMode>,
)
