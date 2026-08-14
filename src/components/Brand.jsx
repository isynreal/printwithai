import { Sparkles } from 'lucide-react'

export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="畫畫猜 AI">
      <span className="brand-spark"><Sparkles size={compact ? 16 : 21} strokeWidth={2.7} /></span>
      <span>畫畫猜</span><strong>AI</strong>
    </div>
  )
}

export function AppHeader({ playerName, onHome }) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={onHome} aria-label="回到大廳"><Brand compact /></button>
      <div className="header-user"><span className="avatar avatar--small">{playerName.slice(0, 1)}</span>{playerName}</div>
    </header>
  )
}
