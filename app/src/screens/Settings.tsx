import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearUser, goalFor, setWeightUnit, useStore } from '../data/store'
import { localDate } from '../lib/dates'
import { GoalSetting, SavedFoods } from '../components/ProteinSettings'

type Props = { session: Session; onClose: () => void }

// Rarely changed setup lives here, so the daily screens stay focused on logging
export default function Settings({ session, onClose }: Props) {
  const store = useStore()
  const [synced, setSynced] = useState<'checking' | 'ok' | 'error'>('checking')

  // Reads the user's own settings row: confirms the database recognises this login.
  useEffect(() => {
    supabase.from('user_settings').select('user_id').maybeSingle()
      .then(({ data, error }) => setSynced(!error && data ? 'ok' : 'error'))
  }, [])

  const unit = store.settings.body_weight_unit

  return (
    <>
      <button className="link back" onClick={onClose}>‹ Back</button>
      <div className="hdr"><h1>Settings</h1></div>

      <h2 className="sec">Protein</h2>
      <GoalSetting current={goalFor(store, localDate())} />
      <SavedFoods quickAdds={store.quickAdds} />

      <h2 className="sec">Body weight</h2>
      <div className="card hdr">
        <span>Unit</span>
        <div className="seg small" role="group" aria-label="Body weight unit">
          <button className="pick" aria-pressed={unit === 'kg'} onClick={() => setWeightUnit('kg')}>kg</button>
          <button className="pick" aria-pressed={unit === 'lb'} onClick={() => setWeightUnit('lb')}>lb</button>
        </div>
      </div>

      <h2 className="sec">Account</h2>
      <div className="card form">
        <b style={{ overflowWrap: 'anywhere' }}>{session.user.email}</b>
        <span className="cap">
          {synced === 'checking' ? 'Checking sync…' : synced === 'ok' ? 'Your data syncs across your devices.' : 'Couldn’t reach your data. Check your connection.'}
        </span>
        <button className="btn ghost" onClick={() => { clearUser(); supabase.auth.signOut() }}>Sign out</button>
      </div>
    </>
  )
}
