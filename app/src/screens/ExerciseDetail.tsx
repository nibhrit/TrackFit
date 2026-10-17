import { useState } from 'react'
import { archiveExercise, deleteSession, lastSession, saveSession, showToast, todaySession, updateExercise, useStore } from '../data/store'
import { GROUPS, STEP, type Exercise, type LiftSet, type MuscleGroup, type Unit } from '../data/types'
import { fmtDate } from '../lib/dates'
import { fmtSets, fmtWeight } from '../lib/format'

type Props = { exercise: Exercise; repeat?: boolean; onBack: () => void }

// Weights are edited as text so "62." can be typed on the way to "62.5"
type Draft = { weight: string; unit: Unit }

const toDraft = (sets: LiftSet[]): Draft[] => sets.map((s) => ({ weight: fmtWeight(s.weight), unit: s.unit }))
const parse = (w: string) => (w.trim() === '' ? NaN : Number(w.replace(',', '.')))
const valid = (w: string) => { const n = parse(w); return Number.isFinite(n) && n >= 0 && n <= 1000 }

export default function ExerciseDetail({ exercise, repeat = false, onBack }: Props) {
  const store = useStore()
  const last = lastSession(store, exercise.id)
  const today = todaySession(store, exercise.id)

  const savedDraft = toDraft(today?.sets ?? [])
  const savedKey = JSON.stringify(savedDraft)

  // "Repeat" from Today: start from last session's sets when nothing is logged today yet
  const repeating = repeat && !today && !!last
  const [draft, setDraftState] = useState<Draft[]>(repeating ? toDraft(last!.sets) : savedDraft)
  const [touched, setTouched] = useState(repeating)
  const [base, setBase] = useState(savedKey)
  const [error, setError] = useState<string | null>(null)

  // If today's saved session arrives or changes (data loaded, synced from another device)
  // and you haven't started editing, show it.
  if (savedKey !== base) {
    setBase(savedKey)
    if (!touched) setDraftState(savedDraft)
  }

  const setDraft = (d: Draft[]) => { setDraftState(d); setTouched(true) }
  const dirty = JSON.stringify(draft) !== savedKey

  const update = (i: number, patch: Partial<Draft>) => { setDraft(draft.map((d, j) => (j === i ? { ...d, ...patch } : d))); setError(null) }

  function step(i: number, dir: 1 | -1) {
    const d = draft[i]
    const n = valid(d.weight) ? parse(d.weight) : 0
    update(i, { weight: fmtWeight(Math.max(0, n + dir * STEP[d.unit])) })
  }

  function addSet() {
    // New set copies the previous one; the first copies last session's first set
    const prev = draft[draft.length - 1]
    const seed: Draft = prev ?? (last ? toDraft(last.sets)[0] : { weight: '0', unit: exercise.default_unit })
    setDraft([...draft, { ...seed }])
    setError(null)
  }

  function save() {
    const bad = draft.findIndex((d) => !valid(d.weight))
    if (bad >= 0) return setError(`Set ${bad + 1}: enter a weight between 0 and 1000.`)
    if (!draft.length && today) { setTouched(false); return deleteSession(today.id) }
    saveSession(exercise.id, draft.map((d, i) => ({ set_number: i + 1, weight: parse(d.weight), unit: d.unit })), today?.id)
    setTouched(false)
    showToast(navigator.onLine ? (today ? 'Session updated' : 'Session saved') : 'Saved on this phone. It will sync when you have signal.')
  }

  return (
    <>
      <button className="link back" onClick={onBack}>‹ All exercises</button>
      <div className="hdr">
        <h1>{exercise.name}</h1>
        <span className="cap">{exercise.muscle_group}</span>
      </div>

      {last ? (
        <div className="slab">
          <span className="cap">Last on {fmtDate(last.local_date)}</span>
          <span className="num slab-weights">{fmtSets(last.sets)}</span>
        </div>
      ) : (
        <div className="card cap">No earlier sessions yet. Today’s will show here next time.</div>
      )}

      <div className="hdr sec-row">
        <span className="sec">Today{today && !dirty ? ' · saved' : ''}</span>
        {last && !draft.length && (
          <button className="link" onClick={() => setDraft(toDraft(last.sets))}>Repeat last</button>
        )}
      </div>

      <div className="list">
        {draft.map((d, i) => (
          <div className="set-row" key={i}>
            <span className="cap">Set {i + 1}</span>
            <div className="stepper">
              <button className="pm" aria-label={`Decrease set ${i + 1}`} onClick={() => step(i, -1)}>−</button>
              <input
                className="num weight" inputMode="decimal" aria-label={`Set ${i + 1} weight`}
                value={d.weight} onChange={(e) => update(i, { weight: e.target.value })}
                onFocus={(e) => e.target.select()}
              />
              <button className="pm" aria-label={`Increase set ${i + 1}`} onClick={() => step(i, 1)}>+</button>
            </div>
            <div className="set-actions">
              <button className="unit-btn" aria-label={`Set ${i + 1} unit, ${d.unit}. Switch unit`} onClick={() => update(i, { unit: d.unit === 'kg' ? 'lb' : 'kg' })}>{d.unit}</button>
              <button className="remove" aria-label={`Remove set ${i + 1}`} onClick={() => { setDraft(draft.filter((_, j) => j !== i)); setError(null) }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="err" role="alert">{error}</p>}

      <div className="two">
        <button className="btn ghost" onClick={addSet}>Add set</button>
        {dirty && (draft.length || today) ? (
          <button className={`btn${!draft.length ? ' danger' : ''}`} onClick={save}>
            {!draft.length ? 'Delete session' : today ? 'Update session' : 'Save session'}
          </button>
        ) : <span />}
      </div>

      <EditExercise exercise={exercise} onRemoved={onBack} />
    </>
  )
}

function EditExercise({ exercise, onRemoved }: { exercise: Exercise; onRemoved: () => void }) {
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
    <details className="card edit-ex">
      <summary>Edit exercise</summary>
      <form className="form" onSubmit={save} noValidate>
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
        <div className="form">
          <b>Remove {exercise.name}?</b>
          <p className="cap" style={{ margin: 0 }}>It disappears from your lists. Past sessions are kept.</p>
          <div className="two">
            <button className="btn ghost" onClick={() => setConfirmRemove(false)}>Keep it</button>
            <button className="btn danger" onClick={() => { archiveExercise(exercise.id); onRemoved() }}>Remove</button>
          </div>
        </div>
      )}
    </details>
  )
}
