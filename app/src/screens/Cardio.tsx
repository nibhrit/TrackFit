import { useState } from 'react'
import { bodyKg, cardioOn, deleteCardio, kcalOn, logCardio, updateCardio, useStore } from '../data/store'
import { CARDIO_KINDS, cardioName, type Cardio as CardioEntry, type CardioKind, type Effort } from '../data/types'
import { fmtDate, localDate } from '../lib/dates'
import { cardioKcal } from '../lib/calories'
import Header from '../components/Header'

const EFFORTS: [Effort, string][] = [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']]
const QUICK_MINUTES = [15, 20, 30, 45]
const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
const effortName = (e: Effort) => EFFORTS.find(([id]) => id === e)![1]

export default function Cardio() {
  const store = useStore()
  const today = localDate()
  const entries = [...cardioOn(store, today)].reverse()
  const kcal = kcalOn(store, today)

  // Most recent session of each type (before today), for one-tap repeat
  const recent = [...store.cardio].reverse()
    .filter((c) => c.local_date < today)
    .filter((c, i, all) => all.findIndex((x) => x.kind === c.kind) === i)
    .slice(0, 3)

  return (
    <>
      <Header title="Cardio" aside={kcal.cardio ? `about ${kcal.cardio} kcal today` : undefined} />
      <LogCardio />

      {recent.length > 0 && (
        <>
          <h2 className="sec">Repeat</h2>
          <div className="chips scroll">
            {recent.map((c) => (
              <button key={c.id} className="chip" onClick={() => logCardio(c.kind, c.minutes, c.effort)}>
                + {cardioName(c.kind)} <b>{c.minutes} min</b>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="sec">Today</h2>
      {entries.length ? (
        <div className="list">{entries.map((c) => <CardioRow key={c.id} entry={c} />)}</div>
      ) : (
        <p className="cap empty">No cardio logged today.</p>
      )}
    </>
  )
}

function LogCardio() {
  const store = useStore()
  const [kind, setKind] = useState<CardioKind>('treadmill_run')
  const [minutes, setMinutes] = useState('')
  const [effort, setEffort] = useState<Effort>('moderate')
  const [error, setError] = useState<string | null>(null)
  const m = toInt(minutes)
  const { kg, estimated } = bodyKg(store)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!Number.isInteger(m) || m < 1 || m > 600) return setError('Enter minutes between 1 and 600.')
    logCardio(kind, m, effort)
    setMinutes('')
    setError(null)
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <select id="cardio-kind" aria-label="Type of cardio" value={kind} onChange={(e) => setKind(e.target.value as CardioKind)}>
        {CARDIO_KINDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <div className="entry-row">
        <input id="cardio-min" className="num" inputMode="numeric" placeholder="Minutes" aria-label="Minutes"
          value={minutes} onChange={(e) => { setMinutes(e.target.value); setError(null) }} />
        <div className="seg small" role="group" aria-label="Quick minutes">
          {QUICK_MINUTES.slice(1, 3).map((q) => (
            <button key={q} type="button" className="pick" aria-pressed={m === q} onClick={() => { setMinutes(String(q)); setError(null) }}>{q}</button>
          ))}
        </div>
        <span />
      </div>
      <div className="seg" role="group" aria-label="Effort">
        {EFFORTS.map(([id, name]) => (
          <button key={id} type="button" className="pick" aria-pressed={effort === id} onClick={() => setEffort(id)}>{name}</button>
        ))}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" type="submit">
        {Number.isInteger(m) && m > 0 ? `Log · about ${Math.round(cardioKcal(kind, effort, m, kg))} kcal` : 'Log cardio'}
      </button>
      {estimated && <p className="cap" style={{ margin: 0 }}>Calories assume 70 kg until you log your weight on Week.</p>}
    </form>
  )
}

function CardioRow({ entry }: { entry: CardioEntry }) {
  const store = useStore()
  const [editing, setEditing] = useState(false)
  const [minutes, setMinutes] = useState(String(entry.minutes))
  const [effort, setEffort] = useState<Effort>(entry.effort)
  const [error, setError] = useState<string | null>(null)
  const kcal = Math.round(cardioKcal(entry.kind, entry.effort, entry.minutes, bodyKg(store).kg))

  if (!editing) {
    return (
      <button className="row" onClick={() => { setMinutes(String(entry.minutes)); setEffort(entry.effort); setEditing(true) }}>
        <span className="row-main">
          <span>{cardioName(entry.kind)}</span>
          <span className="cap">{effortName(entry.effort)} · about {kcal} kcal</span>
        </span>
        <span className="num row-weights">{entry.minutes} min</span>
      </button>
    )
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const m = toInt(minutes)
    if (!Number.isInteger(m) || m < 1 || m > 600) return setError('Enter minutes between 1 and 600.')
    updateCardio(entry.id, { minutes: m, effort })
    setEditing(false)
  }

  return (
    <form className="card form" onSubmit={save} noValidate>
      <b>{cardioName(entry.kind)}, {fmtDate(entry.local_date)}</b>
      <input className="field num" inputMode="numeric" aria-label="Minutes" value={minutes} onChange={(e) => { setMinutes(e.target.value); setError(null) }} />
      <div className="seg" role="group" aria-label="Effort">
        {EFFORTS.map(([id, name]) => (
          <button key={id} type="button" className="pick" aria-pressed={effort === id} onClick={() => setEffort(id)}>{name}</button>
        ))}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="three">
        <button type="button" className="link danger" onClick={() => deleteCardio(entry.id)}>Delete</button>
        <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        <button type="submit" className="btn">Save</button>
      </div>
    </form>
  )
}
