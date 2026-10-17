import { useState } from 'react'
import {
  addQuickAdd, deleteProtein, deleteQuickAdd, goalFor, logProtein, moveQuickAdd, proteinOn, setGoal,
  updateProtein, updateQuickAdd, useStore,
} from '../data/store'
import type { ProteinEntry, QuickAdd } from '../data/types'
import { localDate } from '../lib/dates'
import ProteinSummary from '../components/ProteinRing'
import QuickAdds from '../components/QuickAdds'

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function Protein() {
  const store = useStore()
  const today = localDate()
  const entries = [...proteinOn(store, today)].reverse()

  return (
    <>
      <div className="hdr">
        <h1>Protein</h1>
        <span className="cap">Goal {goalFor(store, today)} g</span>
      </div>
      <div className="card"><ProteinSummary /></div>
      <QuickAdds offerStarters />
      <LogForm quickAdds={store.quickAdds} />

      <h2 className="sec">Today’s entries</h2>
      {entries.length ? (
        <div className="list">{entries.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
      ) : (
        <div className="card cap">Nothing logged yet today. Tap a saved food or enter grams above.</div>
      )}

      <SavedFoods quickAdds={store.quickAdds} />
      <GoalSetting key={goalFor(store, today)} current={goalFor(store, today)} />
    </>
  )
}

function LogForm({ quickAdds }: { quickAdds: QuickAdd[] }) {
  const [food, setFood] = useState('')
  const [grams, setGrams] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmBig, setConfirmBig] = useState(false)

  function pick(v: string) {
    setFood(v)
    setError(null)
    const q = quickAdds.find((x) => x.id === v)
    if (q) { setGrams(String(q.grams)); setLabel(q.name) } else { setGrams(''); setLabel('') }
  }

  function submit(e: React.FormEvent, force = false) {
    e.preventDefault()
    const g = toInt(grams)
    if (!Number.isInteger(g) || g < 1) return setError('Enter grams as a whole number above 0.')
    if (g > 1000) return setError('One entry can be at most 1000 g.')
    if (g > 300 && !force) return setConfirmBig(true)
    const q = quickAdds.find((x) => x.id === food)
    logProtein(g, label || null, q && q.grams === g && q.name === label ? q.id : null)
    setFood(''); setGrams(''); setLabel(''); setError(null); setConfirmBig(false)
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      {quickAdds.length > 0 && (
        <select id="food" aria-label="Choose food" value={food} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose food</option>
          {quickAdds.map((q) => <option key={q.id} value={q.id}>{q.name}, {q.grams} g</option>)}
          <option value="other">Something else</option>
        </select>
      )}
      <div className="log-row">
        <input id="grams" className="num" inputMode="numeric" placeholder="Grams" aria-label="Grams of protein"
          value={grams} onChange={(e) => { setGrams(e.target.value); setError(null); setConfirmBig(false) }} />
        <input id="plabel" placeholder="Dinner" aria-label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn" type="submit">Log</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {confirmBig && (
        <div className="confirm">
          <span>That’s more than 300 g in one entry. Log it anyway?</span>
          <button type="button" className="btn ghost" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>Log {grams} g</button>
        </div>
      )}
    </form>
  )
}

function EntryRow({ entry }: { entry: ProteinEntry }) {
  const [editing, setEditing] = useState(false)
  const [grams, setGrams] = useState(String(entry.grams))
  const [label, setLabel] = useState(entry.label ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <button className="row" onClick={() => { setGrams(String(entry.grams)); setLabel(entry.label ?? ''); setEditing(true) }}>
        <span className="row-main"><span>{entry.label ?? 'Protein'}</span><span className="cap">{timeOf(entry.logged_at)}</span></span>
        <span className="num row-weights">{entry.grams} g</span>
      </button>
    )
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const g = toInt(grams)
    if (!Number.isInteger(g) || g < 1 || g > 1000) return setError('Enter grams between 1 and 1000.')
    updateProtein(entry.id, g, label || null)
    setEditing(false)
  }

  return (
    <form className="card form" onSubmit={save} noValidate>
      <div className="log-row">
        <input className="num" inputMode="numeric" aria-label="Grams" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
        <input aria-label="Label" placeholder="Protein" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="three">
        <button type="button" className="link danger" onClick={() => deleteProtein(entry.id)}>Delete</button>
        <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        <button type="submit" className="btn">Save</button>
      </div>
    </form>
  )
}

function SavedFoods({ quickAdds }: { quickAdds: QuickAdd[] }) {
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const err = await addQuickAdd(name, toInt(grams))
    setError(err)
    if (!err) { setName(''); setGrams('') }
  }

  return (
    <details className="card edit-ex">
      <summary>Saved foods</summary>
      {quickAdds.map((q, i) => <FoodRow key={q.id} food={q} first={i === 0} last={i === quickAdds.length - 1} />)}
      <form className="form" onSubmit={add} noValidate>
        <label htmlFor="new-food">Add a food</label>
        <div className="log-row">
          <input id="new-food" placeholder="Protein bar" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} />
          <input className="num" inputMode="numeric" placeholder="g" aria-label="Grams of protein" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
          <button className="btn" type="submit">Add</button>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </details>
  )
}

function FoodRow({ food, first, last }: { food: QuickAdd; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(food.name)
  const [grams, setGrams] = useState(String(food.grams))
  const [error, setError] = useState<string | null>(null)

  if (editing) {
    return (
      <form className="form" onSubmit={async (e) => {
        e.preventDefault()
        const err = await updateQuickAdd(food.id, name, toInt(grams))
        setError(err)
        if (!err) setEditing(false)
      }} noValidate>
        <div className="log-row">
          <input aria-label="Food name" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} />
          <input className="num" inputMode="numeric" aria-label="Grams" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="three">
          <button type="button" className="link danger" onClick={() => deleteQuickAdd(food.id)}>Delete</button>
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    )
  }

  return (
    <div className="food-row">
      <button className="food-name" onClick={() => setEditing(true)}>
        <span>{food.name}</span> <span className="cap">{food.grams} g</span>
      </button>
      <button className="icon-btn" aria-label={`Move ${food.name} up`} disabled={first} onClick={() => moveQuickAdd(food.id, -1)}>↑</button>
      <button className="icon-btn" aria-label={`Move ${food.name} down`} disabled={last} onClick={() => moveQuickAdd(food.id, 1)}>↓</button>
    </div>
  )
}

function GoalSetting({ current }: { current: number }) {
  const [value, setValue] = useState(String(current))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const err = await setGoal(toInt(value))
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Saved. Applies from today.' })
  }

  return (
    <details className="card edit-ex">
      <summary>Daily goal</summary>
      <form className="form" onSubmit={save} noValidate>
        <div className="log-row">
          <input id="goal" className="num" inputMode="numeric" aria-label="Daily protein goal in grams" value={value}
            onChange={(e) => { setValue(e.target.value); setMsg(null) }} />
          <span className="cap" style={{ alignSelf: 'center' }}>g per day</span>
          <button className="btn" type="submit">Save</button>
        </div>
        {msg && <p className={msg.ok ? 'cap' : 'err'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>{msg.text}</p>}
        <p className="cap" style={{ margin: 0 }}>Changing the goal applies from today. Earlier days keep the goal they had.</p>
      </form>
    </details>
  )
}
