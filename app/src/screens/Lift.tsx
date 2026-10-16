import { useState } from 'react'
import { addExercise, addStarters, toggleSplit, useStore } from '../data/store'
import { GROUPS, STARTERS, type Exercise, type MuscleGroup, type Unit } from '../data/types'
import ExerciseDetail from './ExerciseDetail'

export default function Lift() {
  const { loaded, exercises, settings } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const open = exercises.find((e) => e.id === openId)
  if (open) return <ExerciseDetail exercise={open} onBack={() => setOpenId(null)} />

  const split = settings.current_split
  const q = query.trim().toLowerCase()
  const groups = GROUPS.filter((g) => exercises.some((e) => e.muscle_group === g))
  const shown = groups.filter((g) => !split.length || split.includes(g))
  const inGroup = (g: MuscleGroup) => exercises.filter((e) => e.muscle_group === g && (!q || e.name.toLowerCase().includes(q)))

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
            onChange={(e) => e.target.value && setOpenId(e.target.value)}
          >
            <option value="">Choose exercise</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {exercises.filter((e) => e.muscle_group === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>

          <div className="sec">Today’s split</div>
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
                  {list.map((e) => <ExerciseRow key={e.id} exercise={e} onOpen={() => setOpenId(e.id)} />)}
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
  return (
    <button className="row" onClick={onOpen}>
      <span>{exercise.name}</span>
      <span className="cap">{exercise.default_unit}</span>
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
