import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useSession } from './lib/useSession'
import SignIn from './screens/SignIn'
import Settings from './screens/Settings'
import Lift from './screens/Lift'
import Toast from './components/Toast'
import { clearUser, loadForUser, useStore } from './data/store'

type Tab = 'today' | 'lift' | 'protein' | 'week'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /> },
  { id: 'lift', label: 'Lift', icon: <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" /> },
  { id: 'protein', label: 'Protein', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8" strokeWidth="3.2" /></> },
  { id: 'week', label: 'Week', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
]

const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function App() {
  const session = useSession()
  const [tab, setTab] = useState<Tab>('today')
  const [showSettings, setShowSettings] = useState(false)
  const userId = session?.user.id
  const { pending } = useStore()

  // First sign-in on any device: make sure the user's settings row exists (no-op afterwards).
  useEffect(() => {
    if (!userId) { clearUser(); return }
    supabase.from('user_settings').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
      .then(() => loadForUser(userId))
  }, [userId])

  useEffect(() => { if (!session) setShowSettings(false) }, [session])

  if (session === undefined) return <div className="app" aria-busy="true" />
  if (session === null) return <div className="app"><main><SignIn /></main></div>

  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="app">
      <main>
        {pending > 0 && (
          <div className="sync" role="status">
            {pending === 1 ? '1 change' : `${pending} changes`} saved on this phone, waiting for signal
          </div>
        )}
        {showSettings ? (
          <Settings session={session} onClose={() => setShowSettings(false)} />
        ) : tab === 'lift' ? (
          <Lift />
        ) : (
          <>
            <div className="hdr">
              <h1>{current.label}</h1>
              <span className="hdr-right">
                <span className="cap">{today}</span>
                <button className="icon-btn" aria-label="Settings" onClick={() => setShowSettings(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
                  </svg>
                </button>
              </span>
            </div>
            <div className="card cap">
              TrackFit is being built. This screen will show your {current.label.toLowerCase()} data.
            </div>
          </>
        )}
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={!showSettings && t.id === tab ? 'page' : undefined}
            onClick={() => { setTab(t.id); setShowSettings(false) }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
      <Toast />
    </div>
  )
}
