import { useState } from 'react'
import { addQuickAdd, deleteQuickAdd, linkQuickAdd, moveQuickAdd, setFitnessGoal, setGoal, setKcalGoal, updateQuickAdd } from '../data/store'
import { FITNESS_GOALS, NO_NUTRIENTS, type FitnessGoal, type QuickAdd } from '../data/types'
import { portionText } from '../lib/nutrition'
import { isAiFood } from '../lib/aiEstimate'
import FoodFinder from './FoodFinder'

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
// Empty = calories not known
const toKcal = (v: string) => (v.trim() ? toInt(v) : null)

// Rarely changed food setup, shown in Settings: goal, saved foods, the protein goal and the calorie target

export function SavedFoods({ quickAdds }: { quickAdds: QuickAdd[] }) {
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('')
  const [kcal, setKcal] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Opens by itself while some saved food has no calories (the Food tab's "Fix" lands here)
  const missing = quickAdds.filter((q) => q.kcal == null).length
  const [open] = useState(missing > 0)

  function add(e: React.FormEvent) {
    e.preventDefault()
    const err = addQuickAdd(name, { ...NO_NUTRIENTS, grams: grams.trim() ? toInt(grams) : 0, kcal: toKcal(kcal) })
    setError(err)
    if (!err) { setName(''); setGrams(''); setKcal('') }
  }

  return (
    <details className="card edit-ex" open={open}>
      <summary>Saved foods{missing > 0 ? ` · ${missing} without calories` : ''}</summary>
      {missing > 0 && <p className="cap note">Link each one to a food from the list to add calories, carbs, fat, fibre and sugar.</p>}
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

// "Dal, 1 bowl" → "Dal", "Greek yogurt cup" → "Greek yogurt": amounts and measures are picked as the portion instead
const searchTerms = (name: string) =>
  name.replace(/\d+(\.\d+)?\s*(g|gm|grams?|ml)?\b/gi, ' ')
    .replace(/\b(bowl|cup|scoop|piece|pieces|katori|plate|glass|tbsp|tsp|serving|handful)s?\b/gi, ' ')
    .replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim() || name

function FoodRow({ food, first, last }: { food: QuickAdd; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [name, setName] = useState(food.name)
  const [grams, setGrams] = useState(String(food.grams))
  const [kcal, setKcal] = useState(food.kcal == null ? '' : String(food.kcal))
  const [error, setError] = useState<string | null>(null)
  const portion = portionText(food)

  if (editing) {
    return (
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        const err = updateQuickAdd(food.id, name, toInt(grams), toKcal(kcal))
        setError(err)
        if (!err) setEditing(false)
      }} noValidate>
        <input aria-label="Food name" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} />
        <div className="two">
          <input className="num" inputMode="numeric" aria-label="Grams of protein" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
          <input className="num" inputMode="numeric" aria-label="Calories (optional)" placeholder="kcal" value={kcal} onChange={(e) => { setKcal(e.target.value); setError(null) }} />
        </div>
        {food.food_id && (
          <p className="cap" style={{ margin: 0 }}>
            {isAiFood(food.food_id) ? 'From an AI estimate' : 'From the food list'}{portion ? `, ${portion}` : ''}. Changing the numbers makes it a typed food.
          </p>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <div className="three">
          <button type="button" className="link danger" onClick={() => deleteQuickAdd(food.id)}>Delete</button>
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    )
  }

  // Link to a food: its protein is recomputed from the food list, so show the old value next to the new one
  if (linking) {
    return (
      <div className="link-food">
        <FoodFinder
          initialQuery={searchTerms(food.name)} submitLabel="Link"
          note={`“${food.name}” is now ${food.grams} g protein, no calories. Linking replaces it with the food’s values (protein may change).`}
          onDone={(n, ref) => { linkQuickAdd(food.id, n, ref); setLinking(false) }}
          onCancel={() => setLinking(false)}
        />
      </div>
    )
  }

  return (
    <div className="food-row">
      <button className="food-name" onClick={() => setEditing(true)}>
        <span>{food.name}</span> <span className="cap">{food.grams} g{food.kcal != null ? ` · ${food.kcal} kcal` : ' · no kcal'}</span>
      </button>
      <button className="icon-btn" aria-label={`Move ${food.name} up`} disabled={first} onClick={() => moveQuickAdd(food.id, -1)}>↑</button>
      <button className="icon-btn" aria-label={`Move ${food.name} down`} disabled={last} onClick={() => moveQuickAdd(food.id, 1)}>↓</button>
      {food.kcal == null && <button className="link small link-btn" onClick={() => setLinking(true)}>Link to a food</button>}
    </div>
  )
}

// Lose fat / maintain / build muscle: sets the macro targets (protein per kg, fat share) and the calorie suggestion
export function FitnessGoalSetting({ current }: { current: FitnessGoal }) {
  return (
    <div className="card form">
      <span className="label">Goal</span>
      <div className="seg small" role="group" aria-label="Fitness goal">
        {FITNESS_GOALS.map(([id, name]) => (
          <button key={id} className="pick" aria-pressed={current === id} onClick={() => setFitnessGoal(id)}>{name}</button>
        ))}
      </div>
      <p className="cap" style={{ margin: 0 }}>
        {current === 'lose_fat' ? 'High protein (2 g per kg) to keep muscle while eating less.'
          : current === 'build_muscle' ? 'Protein 1.8 g per kg with a small calorie surplus.'
          : 'Protein 1.6 g per kg at maintenance calories.'} Used for the targets under Macros on the Food tab.
      </p>
    </div>
  )
}

// suggested: the goal-based protein target the Macros panel uses (g/kg × body weight), offered when it differs
export function GoalSetting({ current, suggested }: { current: number; suggested: number }) {
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
        <p className="cap" style={{ margin: 0 }}>
          Applies from today. Earlier days keep the goal they had.
          {Math.abs(suggested - current) >= 5 && <> Your goal and weight suggest about {suggested} g. <button type="button" className="link small" onClick={() => { setValue(String(suggested)); setMsg(null) }}>Use {suggested} g</button></>}
        </p>
      </form>
    </div>
  )
}

// Calorie target. No default is applied: until one is saved the app shows calories eaten without a target.
// The suggestion is a rough figure for the goal (kcal per kg of body weight, see lib/macros.ts), labelled as such.
const GOAL_NOTE: Record<FitnessGoal, string> = {
  lose_fat: 'losing fat slowly (about 24 kcal per kg of body weight, roughly 20% under maintenance)',
  maintain: 'keeping your weight steady (about 30 kcal per kg of body weight)',
  build_muscle: 'building muscle (about 33 kcal per kg of body weight, roughly 10% over maintenance)',
}

export function CalorieGoalSetting({ current, suggested, goal }: { current: number | null; suggested: number; goal: FitnessGoal }) {
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
          {current == null ? 'Not set yet. ' : ''}{suggested} kcal is a rough starting point for {GOAL_NOTE[goal]}.{' '}
          Needs vary with age, height and activity: treat it as a guide and adjust after a few weeks of weigh-ins. Applies from today.
        </p>
      </form>
    </div>
  )
}
