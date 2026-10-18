import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useSession } from './lib/useSession'
import SignIn from './screens/SignIn'
import Settings from './screens/Settings'
import Lift, { type LiftTarget } from './screens/Lift'
import Today from './screens/Today'
import Protein from './screens/Protein'
import Week from './screens/Week'
import Cardio from './screens/Cardio'
import Toast from './components/Toast'
import { SettingsContext } from './lib/settingsContext'
import { clearUser, loadForUser, useStore } from './data/store'

type Tab = 'today' | 'lift' | 'cardio' | 'protein' | 'week'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /> },
  { id: 'lift', label: 'Lift', icon: <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" /> },
  { id: 'cardio', label: 'Cardio', icon: <path d="M3 12h4l2-5 4 10 2-5h6" /> },
  { id: 'protein', label: 'Protein', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8" strokeWidth="3.2" /></> },
  { id: 'week', label: 'Week', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
]

export default function App() {
  const session = useSession()
  const [tab, setTab] = useState<Tab>('today')
  const [showSettings, setShowSettings] = useState(false)
  const [liftTarget, setLiftTarget] = useState<LiftTarget | null>(null)
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

  return (
    <SettingsContext.Provider value={() => setShowSettings(true)}>
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
          <Lift target={liftTarget} />
        ) : tab === 'cardio' ? (
          <Cardio />
        ) : tab === 'protein' ? (
          <Protein />
        ) : tab === 'week' ? (
          <Week />
        ) : (
          <Today
            onOpenExercise={(id, repeat) => { setLiftTarget({ id, repeat, key: Date.now() }); setTab('lift') }}
            onGoToLift={() => { setLiftTarget(null); setTab('lift') }}
            onGoToProtein={() => setTab('protein')}
          />
        )}
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={!showSettings && t.id === tab ? 'page' : undefined}
            onClick={() => { setTab(t.id); setShowSettings(false); setLiftTarget(null) }}
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
    </SettingsContext.Provider>
  )
}
