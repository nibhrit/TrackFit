import { useState } from 'react'
import { addQuickAdd, deleteQuickAdd, moveQuickAdd, setGoal, updateQuickAdd } from '../data/store'
import type { QuickAdd } from '../data/types'

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)

// Rarely changed protein setup, shown in Settings: saved foods and the daily goal

export function SavedFoods({ quickAdds }: { quickAdds: QuickAdd[] }) {
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

export function GoalSetting({ current }: { current: number }) {
  const [value, setValue] = useState(String(current))
  const [base, setBase] = useState(current)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // If the goal changes elsewhere (loaded, synced from another device), show it unless you're mid-edit
  if (current !== base) {
    setBase(current)
    if (value === String(base)) setValue(String(current))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const err = setGoal(toInt(value))
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Saved. Applies from today.' })
  }

  return (
    <div className="card">
      <form className="form" onSubmit={save} noValidate>
        <label htmlFor="goal">Daily goal</label>
        <div className="log-row">
          <input id="goal" className="num" inputMode="numeric" aria-label="Daily protein goal in grams" value={value}
            onChange={(e) => { setValue(e.target.value); setMsg(null) }} />
          <span className="cap" style={{ alignSelf: 'center' }}>g per day</span>
          <button className="btn" type="submit">Save</button>
        </div>
        {msg && <p className={msg.ok ? 'cap' : 'err'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>{msg.text}</p>}
        <p className="cap" style={{ margin: 0 }}>Applies from today. Earlier days keep the goal they had.</p>
      </form>
    </div>
  )
}
