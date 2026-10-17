import { habitsOn, setHabit, useStore } from '../data/store'
import type { HabitKey } from '../data/types'
import { localDate } from '../lib/dates'

const HABITS: [HabitKey, string][] = [['sugar', 'Sugar'], ['junk_food', 'Junk food']]

// End-of-day check-in. "Avoided" is green; "Had it" is graphite (never red: a slip isn't an error).
export default function HabitsCard() {
  const store = useStore()
  const day = habitsOn(store, localDate())
  const done = day.sugar && day.junk_food

  return (
    <div className="card form">
      <div className="hdr">
        <b>End of day</b>
        <span className="cap">{done ? 'Logged for today' : 'Log before bed'}</span>
      </div>
      {HABITS.map(([key, label]) => (
        <div key={key} className="habit-row">
          <span>{label}</span>
          <div className="seg" role="group" aria-label={label}>
            <button className="ok" aria-pressed={day[key] === 'avoided'} onClick={() => setHabit(key, 'avoided')}>Avoided</button>
            <button className="no" aria-pressed={day[key] === 'had'} onClick={() => setHabit(key, 'had')}>Had it</button>
          </div>
        </div>
      ))}
    </div>
  )
}
