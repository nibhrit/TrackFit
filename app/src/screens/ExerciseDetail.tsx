import { useState } from 'react'
import { archiveExercise, updateExercise } from '../data/store'
import { GROUPS, type Exercise, type MuscleGroup, type Unit } from '../data/types'

type Props = { exercise: Exercise; onBack: () => void }

export default function ExerciseDetail({ exercise, onBack }: Props) {
  const [name, setName] = useState(exercise.name)
  const [group, setGroup] = useState<MuscleGroup>(exercise.muscle_group)
  const [unit, setUnit] = useState<Unit>(exercise.default_unit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const changed = name.trim() !== exercise.name || group !== exercise.muscle_group || unit !== exercise.default_unit

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const err = await updateExercise(exercise.id, { name, muscle_group: group, default_unit: unit })
    setBusy(false)
    setError(err)
    setSaved(!err)
  }

  return (
    <>
      <button className="link back" onClick={onBack}>‹ All exercises</button>
      <div className="hdr">
        <h1>{exercise.name}</h1>
        <span className="cap">{exercise.muscle_group}</span>
      </div>

      <div className="card cap">Logging sets and seeing your last weights for this exercise come next.</div>

      <form className="card form" onSubmit={save} noValidate>
        <label htmlFor="edit-name">Name</label>
        <input id="edit-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); setSaved(false) }} />
        <div className="two">
          <div className="form">
            <label htmlFor="edit-group">Muscle group</label>
            <select id="edit-group" value={group} onChange={(e) => { setGroup(e.target.value as MuscleGroup); setSaved(false) }}>
              {GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form">
            <label htmlFor="edit-unit">Default unit</label>
            <select id="edit-unit" value={unit} onChange={(e) => { setUnit(e.target.value as Unit); setSaved(false) }}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {saved && !changed && <p className="cap" role="status" style={{ margin: 0 }}>Saved</p>}
        <button className="btn" type="submit" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      {!confirmRemove ? (
        <button className="link danger" onClick={() => setConfirmRemove(true)}>Remove exercise</button>
      ) : (
        <div className="card form">
          <b>Remove {exercise.name}?</b>
          <p className="cap" style={{ margin: 0 }}>It disappears from your lists. Past sessions are kept.</p>
          <div className="two">
            <button className="btn ghost" onClick={() => setConfirmRemove(false)}>Keep it</button>
            <button className="btn danger" onClick={() => { archiveExercise(exercise.id); onBack() }}>Remove</button>
          </div>
        </div>
      )}
    </>
  )
}
