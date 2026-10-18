import { useState } from 'react'
import { goalFor, groupsOn, habitsOn, kcalOn, lastSession, proteinTotal, todaySession, useStore } from '../data/store'
import { GROUPS, type Exercise } from '../data/types'
import { fmtDate, localDate } from '../lib/dates'
import { fmtSets } from '../lib/format'
import Header from '../components/Header'
import QuickAdds from '../components/QuickAdds'
import HabitsCard from '../components/HabitsCard'

type Props = {
  onOpenExercise: (id: string, repeat: boolean) => void
  onGoToLift: () => void
  onGoToProtein: () => void
}

const EVENING_HOUR = 18 // the End of day card appears from 6 pm

export default function Today({ onOpenExercise, onGoToLift, onGoToProtein }: Props) {
  const store = useStore()
  const today = localDate()
  const groups = groupsOn(store, today)
  const habits = habitsOn(store, today)
  const habitsDone = [habits.sugar, habits.junk_food].filter(Boolean).length
  const [showHabits, setShowHabits] = useState(false)
  const habitsVisible = showHabits || habitsDone > 0 || new Date().getHours() >= EVENING_HOUR

  // Exercises for today's split (or everything if no split yet) that have history, most recent first
  const recent = (e: Exercise) => lastSession(store, e.id)?.local_date ?? ''
  const pool = store.exercises
    .filter((e) => !groups.length || groups.includes(e.muscle_group))
    .filter((e) => lastSession(store, e.id) || todaySession(store, e.id))
    .sort((a, b) => recent(b).localeCompare(recent(a)))
  const featured = pool.find((e) => !todaySession(store, e.id))
  const rest = pool.filter((e) => e !== featured).slice(0, 3)

  return (
    <>
      <Header title="Today" aside={new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} />

      <div className="tiles">
        <ProteinTile onOpen={onGoToProtein} />
        <KcalTile />
        <button className="tile" onClick={() => setShowHabits(true)} aria-label={`Habits: ${habitsDone} of 2 logged today`}>
          <span className="num tile-num habit-num">{habitsDone}<span className="tile-of">/2</span></span>
          <span className="cap">habits</span>
        </button>
      </div>

      <QuickAdds />

      <div className="hdr sec-row">
        <span className="sec">{groups.length ? GROUPS.filter((g) => groups.includes(g)).join(', ') : 'Last time'}</span>
        <button className="link" onClick={onGoToLift}>{groups.length ? 'Change' : 'Pick split'}</button>
      </div>

      {!store.loaded && !store.exercises.length ? (
        <p className="cap empty">Loading…</p>
      ) : !pool.length ? (
        <p className="cap empty">Your last weights show here once you’ve logged a session.</p>
      ) : (
        <>
          {featured ? <Featured exercise={featured} onOpen={onOpenExercise} /> : <p className="cap empty">Today’s split is done. Nice work.</p>}
          {rest.length > 0 && (
            <div className="list">
              {rest.map((e) => {
                const done = todaySession(store, e.id)
                const shown = done ?? lastSession(store, e.id)!
                return (
                  <button key={e.id} className="row" onClick={() => onOpenExercise(e.id, false)}>
                    <span className="row-main">
                      <span>{e.name}</span>
                      <span className="cap">{done ? 'Done today' : fmtDate(shown.local_date)}</span>
                    </span>
                    <span className="num row-weights">{fmtSets(shown.sets)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {habitsVisible && <HabitsCard />}
    </>
  )
}

// Estimated calories burnt today; tap to see cardio vs lifting
function KcalTile() {
  const store = useStore()
  const [split, setSplit] = useState(false)
  const k = kcalOn(store, localDate())
  return (
    <button className="tile" onClick={() => setSplit(!split)} aria-label={`About ${k.total} kilocalories burnt today`}>
      <span className="num tile-num">{k.total}</span>
      <span className="cap">{split ? `cardio ${k.cardio} · lift ${k.lifting}` : 'kcal burnt'}</span>
    </button>
  )
}

function ProteinTile({ onOpen }: { onOpen: () => void }) {
  const store = useStore()
  const today = localDate()
  const total = proteinTotal(store, today)
  const goal = goalFor(store, today)
  const C = 2 * Math.PI * 40
  const filled = Math.min(total / goal, 1) * C
  return (
    <button className="tile tile-ring" onClick={onOpen} aria-label={`Protein: ${total} of ${goal} grams`}>
      <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="40" className="ring-track" style={{ strokeWidth: 14 }} />
        {filled > 0 && <circle cx="50" cy="50" r="40" className="ring-fill" style={{ strokeWidth: 14 }} strokeDasharray={`${filled.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 50 50)" />}
      </svg>
      <span>
        <span className="num tile-num">{total}<span className="tile-of"> g</span></span>
        <span className="cap">{total >= goal ? 'goal hit' : `of ${goal} g`}</span>
      </span>
    </button>
  )
}

function Featured({ exercise, onOpen }: { exercise: Exercise; onOpen: (id: string, repeat: boolean) => void }) {
  const store = useStore()
  const last = lastSession(store, exercise.id)!
  return (
    <div className="slab">
      <button className="slab-open" onClick={() => onOpen(exercise.id, false)}>
        <span className="cap">{exercise.name}</span>
        <span className="num slab-weights">{fmtSets(last.sets)}</span>
      </button>
      <div className="slab-foot">
        <span className="cap">Last on {fmtDate(last.local_date)}</span>
        <button className="btn" onClick={() => onOpen(exercise.id, true)}>Repeat</button>
      </div>
    </div>
  )
}
