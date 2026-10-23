import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { bodyKg, clearUser, goalFor, kcalGoalFor, setWeightUnit, useStore } from '../data/store'
import { localDate } from '../lib/dates'
import { CalorieGoalSetting, GoalSetting, SavedFoods } from '../components/ProteinSettings'

const FOOD_DATA_URL = 'https://github.com/nibhrit/TrackFit/blob/main/product/FOOD_DATA.md'

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
  // Rough maintenance suggestion: about 30 kcal per kg, rounded to 50
  const suggestedKcal = Math.round((bodyKg(store).kg * 30) / 50) * 50

  return (
    <>
      <button className="link back" onClick={onClose}>‹ Back</button>
      <div className="hdr"><h1>Settings</h1></div>

      <h2 className="sec">Food</h2>
      <GoalSetting current={goalFor(store, localDate())} />
      <CalorieGoalSetting current={kcalGoalFor(store, localDate())} suggested={suggestedKcal} />
      <SavedFoods quickAdds={store.quickAdds} />
      <p className="cap empty">
        Nutrition data: USDA FoodData Central (public domain). Dishes are TrackFit recipes from those ingredients; restaurant dishes are estimates. Approximate, not medical advice.{' '}
        <a href={FOOD_DATA_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--lift)', fontWeight: 600 }}>Food data sources</a>
      </p>

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
