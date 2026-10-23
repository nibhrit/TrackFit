import { useState } from 'react'
import { addQuickAdd, deleteQuickAdd, moveQuickAdd, setGoal, setKcalGoal, updateQuickAdd } from '../data/store'
import type { QuickAdd } from '../data/types'
import { portionText } from '../lib/nutrition'

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
// Empty = calories not known
const toKcal = (v: string) => (v.trim() ? toInt(v) : null)

// Rarely changed food setup, shown in Settings: saved foods, the protein goal and the calorie target

export function SavedFoods({ quickAdds }: { quickAdds: QuickAdd[] }) {
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('')
  const [kcal, setKcal] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const err = await addQuickAdd(name, { grams: grams.trim() ? toInt(grams) : 0, kcal: toKcal(kcal), carbs_g: null, fat_g: null })
    setError(err)
    if (!err) { setName(''); setGrams(''); setKcal('') }
  }

  return (
    <details className="card edit-ex">
      <summary>Saved foods</summary>
      {quickAdds.map((q, i) => <FoodRow key={q.id} food={q} first={i === 0} last={i === quickAdds.length - 1} />)}
      <form className="form" onSubmit={add} noValidate>
        <label htmlFor="new-food">Add a food</label>
        <input id="new-food" placeholder="Protein bar" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} />
        <div className="nums-row">
          <input className="num" inputMode="numeric" placeholder="Protein g" aria-label="Grams of protein" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
          <input className="num" inputMode="numeric" placeholder="kcal" aria-label="Calories (optional)" value={kcal} onChange={(e) => { setKcal(e.target.value); setError(null) }} />
          <button className="btn" type="submit">Add</button>
        </div>
        <p className="cap" style={{ margin: 0 }}>Tip: on the Food tab, pick a food and portion, then “Save as one-tap food”.</p>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </details>
  )
}

function FoodRow({ food, first, last }: { food: QuickAdd; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(food.name)
  const [grams, setGrams] = useState(String(food.grams))
  const [kcal, setKcal] = useState(food.kcal == null ? '' : String(food.kcal))
  const [error, setError] = useState<string | null>(null)
  const portion = portionText(food)

  if (editing) {
    return (
      <form className="form" onSubmit={async (e) => {
        e.preventDefault()
        const err = await updateQuickAdd(food.id, name, toInt(grams), toKcal(kcal))
        setError(err)
        if (!err) setEditing(false)
      }} noValidate>
        <input aria-label="Food name" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} />
        <div className="two">
          <input className="num" inputMode="numeric" aria-label="Grams of protein" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
          <input className="num" inputMode="numeric" aria-label="Calories (optional)" placeholder="kcal" value={kcal} onChange={(e) => { setKcal(e.target.value); setError(null) }} />
        </div>
        {food.food_id && <p className="cap" style={{ margin: 0 }}>From the food list{portion ? `, ${portion}` : ''}. Changing the numbers makes it a typed food.</p>}
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
        <span>{food.name}</span> <span className="cap">{food.grams} g{food.kcal != null ? ` · ${food.kcal} kcal` : ''}</span>
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
        <label htmlFor="goal">Daily protein goal</label>
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

// Calorie target. No default is applied: until one is saved the app shows calories eaten without a target.
// The suggestion is a rough maintenance figure (about 30 kcal per kg of body weight), labelled as such.
export function CalorieGoalSetting({ current, suggested }: { current: number | null; suggested: number }) {
  const [value, setValue] = useState(String(current ?? suggested))
  const [base, setBase] = useState(current)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (current !== base) {
    setBase(current)
    if (value === String(base ?? suggested)) setValue(String(current ?? suggested))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const err = setKcalGoal(toInt(value))
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Saved. Applies from today.' })
  }

  return (
    <div className="card">
      <form className="form" onSubmit={save} noValidate>
        <label htmlFor="kcal-goal">Daily calorie target</label>
        <div className="log-row">
          <input id="kcal-goal" className="num" inputMode="numeric" aria-label="Daily calorie target in kcal" value={value}
            onChange={(e) => { setValue(e.target.value); setMsg(null) }} />
          <span className="cap" style={{ alignSelf: 'center' }}>kcal per day</span>
          <button className="btn" type="submit">{current == null ? 'Set' : 'Save'}</button>
        </div>
        {msg && <p className={msg.ok ? 'cap' : 'err'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>{msg.text}</p>}
        <p className="cap" style={{ margin: 0 }}>
          {current == null && `Not set yet. ${suggested} kcal is a rough starting point for keeping your weight steady (about 30 kcal per kg of body weight). `}
          Needs vary with age, height and activity: treat it as a guide and adjust after a few weeks of weigh-ins. Applies from today.
        </p>
      </form>
    </div>
  )
}
