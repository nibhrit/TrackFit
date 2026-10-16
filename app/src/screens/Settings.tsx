import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearUser } from '../data/store'

type Props = { session: Session; onClose: () => void }

export default function Settings({ session, onClose }: Props) {
  const [synced, setSynced] = useState<'checking' | 'ok' | 'error'>('checking')

  // Reads the user's own settings row: confirms the database recognises this login.
  useEffect(() => {
    supabase.from('user_settings').select('user_id').maybeSingle()
      .then(({ data, error }) => setSynced(!error && data ? 'ok' : 'error'))
  }, [])

  return (
    <>
      <button className="link back" onClick={onClose}>‹ Back</button>
      <div className="hdr"><h1>Settings</h1></div>
      <div className="card form">
        <span className="cap">Signed in as</span>
        <b style={{ overflowWrap: 'anywhere' }}>{session.user.email}</b>
        <span className="cap">
          {synced === 'checking' ? 'Checking sync…' : synced === 'ok' ? 'Your data syncs across your devices.' : 'Couldn’t reach your data. Check your connection.'}
        </span>
      </div>
      <button className="btn ghost" onClick={() => { clearUser(); supabase.auth.signOut() }}>Sign out</button>
    </>
  )
}
