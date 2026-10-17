import { useState } from 'react'
import { addExercise, addStarters, lastSession, splitFor, toggleSplit, todaySession, useStore } from '../data/store'
import { fmtSets } from '../lib/format'
import { fmtDate, localDate } from '../lib/dates'
import PlanWeek from './PlanWeek'
import { GROUPS, STARTERS, type Exercise, type MuscleGroup, type Unit } from '../data/types'
import ExerciseDetail from './ExerciseDetail'

// Set when another screen (Today) opens an exercise; `key` changes on every request
export type LiftTarget = { id: string; repeat: boolean; key: number }

export default function Lift({ target }: { target?: LiftTarget | null }) {
  const store = useStore()
  const { loaded, exercises } = store
  const [openId, setOpenId] = useState<string | null>(target?.id ?? null)
  const [repeat, setRepeat] = useState(target?.repeat ?? false)
  const [targetKey, setTargetKey] = useState(target?.key)
  const [planning, setPlanning] = useState(false)
  const [query, setQuery] = useState('')

  if (target && target.key !== targetKey) {
    setTargetKey(target.key)
    setOpenId(target.id)
    setRepeat(target.repeat)
    setPlanning(false)
  }

  const open = exercises.find((e) => e.id === openId)
  if (open) return <ExerciseDetail key={open.id} exercise={open} repeat={repeat} onBack={() => { setOpenId(null); setRepeat(false) }} />
  if (planning) return <PlanWeek onBack={() => setPlanning(false)} />

  const split = splitFor(store, localDate())
  const q = query.trim().toLowerCase()
  const groups = GROUPS.filter((g) => exercises.some((e) => e.muscle_group === g))
  const shown = groups.filter((g) => !split.length || split.includes(g))
  // Most recently trained first, then alphabetical
  const lastDate = (e: Exercise) => (todaySession(store, e.id) ?? lastSession(store, e.id))?.local_date ?? ''
  const inGroup = (g: MuscleGroup) => exercises
    .filter((e) => e.muscle_group === g && (!q || e.name.toLowerCase().includes(q)))
    .sort((a, b) => lastDate(b).localeCompare(lastDate(a)) || a.name.localeCompare(b.name))

  return (
    <>
      <div className="hdr">
        <h1>Lift</h1>
        <span className="cap">{exercises.length} exercises</span>
      </div>

      {!loaded && !exercises.length ? (
        <div className="card cap">Loading your exercises…</div>
      ) : !exercises.length ? (
        <Starters />
      ) : (
        <>
          <select
            id="pick-exercise" aria-label="Choose exercise" value=""
            onChange={(e) => { if (e.target.value) { setOpenId(e.target.value); setRepeat(false) } }}
          >
            <option value="">Choose exercise</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {exercises.filter((e) => e.muscle_group === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>

          <div className="hdr sec-row">
            <span className="sec">Today’s split</span>
            <button className="link" onClick={() => setPlanning(true)}>Plan week</button>
          </div>
          <div className="chips scroll" role="group" aria-label="Today’s split">
            {groups.map((g) => (
              <button key={g} className="chip" aria-pressed={split.includes(g)} onClick={() => toggleSplit(g)}>{g}</button>
            ))}
          </div>

          <input
            id="search-exercise" className="field" type="search" placeholder="Search exercises" aria-label="Search exercises"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />

          {shown.map((g) => {
            const list = inGroup(g)
            if (!list.length) return null
            return (
              <section key={g} className="group">
                <h2 className="sec">{g}</h2>
                <div className="list">
                  {list.map((e) => <ExerciseRow key={e.id} exercise={e} onOpen={() => { setOpenId(e.id); setRepeat(false) }} />)}
                </div>
              </section>
            )
          })}
          {q && shown.every((g) => !inGroup(g).length) && (
            <div className="card cap">No exercises match “{query}”{split.length ? ' in today’s split' : ''}.</div>
          )}
        </>
      )}

      <AddExercise defaultGroup={split[0] ?? 'Chest'} />
    </>
  )
}

function ExerciseRow({ exercise, onOpen }: { exercise: Exercise; onOpen: () => void }) {
  const store = useStore()
  const today = todaySession(store, exercise.id)
  const shown = today ?? lastSession(store, exercise.id)
  return (
    <button className="row" onClick={onOpen}>
      <span className="row-main">
        <span>{exercise.name}</span>
        <span className="cap">{today ? 'Done today' : shown ? fmtDate(shown.local_date) : 'Not logged yet'}</span>
      </span>
      {shown && <span className="num row-weights">{fmtSets(shown.sets)}</span>}
    </button>
  )
}

function Starters() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="card form">
      <b>Start with common exercises</b>
      <p className="cap" style={{ margin: 0 }}>
        Adds {STARTERS.length} exercises across all muscle groups, like bench press, lat pulldown and leg press.
        Dumbbell exercises use lb, the rest kg. Rename, change or remove any of them later.
      </p>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" disabled={busy} onClick={async () => { setBusy(true); setError(await addStarters()); setBusy(false) }}>
        {busy ? 'Adding…' : `Add ${STARTERS.length} starter exercises`}
      </button>
      <p className="cap" style={{ margin: 0 }}>Or add your own below.</p>
    </div>
  )
}

function AddExercise({ defaultGroup }: { defaultGroup: MuscleGroup }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState<MuscleGroup | ''>('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const err = await addExercise(name, group || defaultGroup, unit)
    setBusy(false)
    setError(err)
    if (!err) { setName(''); setGroup('') }
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <label htmlFor="new-exercise">Add an exercise</label>
      <input
        id="new-exercise" placeholder="Seated row, machine 5" value={name} autoComplete="off"
        onChange={(e) => { setName(e.target.value); setError(null) }}
      />
      <div className="two">
        <select id="new-group" aria-label="Muscle group" value={group || defaultGroup} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
          {GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select id="new-unit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add exercise'}</button>
    </form>
  )
}
