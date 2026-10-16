import { useState } from 'react'

type Tab = 'today' | 'lift' | 'protein' | 'week'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /> },
  { id: 'lift', label: 'Lift', icon: <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" /> },
  { id: 'protein', label: 'Protein', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8" strokeWidth="3.2" /></> },
  { id: 'week', label: 'Week', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
]

const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="app">
      <main>
        <div className="hdr">
          <h1>{current.label}</h1>
          <span className="cap">{today}</span>
        </div>
        <div className="card cap">
          TrackFit is being built. This screen will show your {current.label.toLowerCase()} data.
        </div>
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} aria-current={t.id === tab ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
