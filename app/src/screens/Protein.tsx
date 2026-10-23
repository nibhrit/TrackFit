import { useState } from 'react'
import {
  addQuickAdd, deleteProtein, goalFor, kcalEatenOn, kcalGoalFor, logFood, logProtein, proteinOn, updateEntry, useStore,
} from '../data/store'
import Header from '../components/Header'
import type { FoodRef, Nutrients, ProteinEntry } from '../data/types'
import type { Food, Portion } from '../data/foods/schema'
import { localDate } from '../lib/dates'
import { foodUsage, searchFoods, topFoods } from '../lib/foodSearch'
import {
  GRAM_STEP, MAX_GRAMS, MAX_QTY, QTY_STEP, defaultPortion, fmtQty, foodRef, nutrientsFor, portionGrams, portionText,
} from '../lib/nutrition'
import { useFoods } from '../lib/useFoods'
import ProteinSummary from '../components/ProteinRing'
import QuickAdds from '../components/QuickAdds'

// The Food tab (was "Protein"): protein ring + calories, one-tap saved foods, search the food list, today's entries.

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
const toNum = (v: string) => (/^\d+([.,]\d+)?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : NaN)
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function Protein() {
  const store = useStore()
  const today = localDate()
  const entries = [...proteinOn(store, today)].reverse()

  return (
    <>
      <Header title="Food" aside={`Goal ${goalFor(store, today)} g`} />
      <div className="card"><ProteinSummary /><KcalLine /></div>
      <QuickAdds offerStarters />
      <AddFood />

      <h2 className="sec">Today’s entries</h2>
      {entries.length ? (
        <div className="list">{entries.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
      ) : (
        <p className="cap empty">Nothing logged yet today.</p>
      )}
    </>
  )
}

// Calories eaten today, under the protein ring: a graphite meter when a target is set
function KcalLine() {
  const store = useStore()
  const today = localDate()
  const { total, missing } = kcalEatenOn(store, today)
  const goal = kcalGoalFor(store, today)
  return (
    <div className="kcal-line">
      <div className="hdr">
        <span><span className="num">{total}</span> <span className="cap">{goal ? `/ ${goal} kcal` : 'kcal eaten'}</span></span>
        <span className="cap">{goal ? (total <= goal ? `${goal - total} left` : `${total - goal} over`) : 'Set a target in Settings'}</span>
      </div>
      {goal && <span className="meter" role="img" aria-label={`${total} of ${goal} kcal`}><span style={{ width: `${Math.min(total / goal, 1) * 100}%` }} /></span>}
      {missing > 0 && <span className="cap">{missing === 1 ? '1 entry has' : `${missing} entries have`} protein only, no calories.</span>}
    </div>
  )
}

// ---------- Adding food: search the list, or type the numbers ----------

type Chosen = { food: Food; portion: Portion | null; qty: number }

function AddFood() {
  const store = useStore()
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [manual, setManual] = useState(false)

  if (manual) return <ManualForm initialLabel={query} onSearch={() => setManual(false)} />
  if (picked) {
    return (
      <PortionPicker
        {...picked} submitLabel="Log"
        onSubmit={(n, ref) => { logFood({ ...n, ...ref, label: picked.food.name }); setPicked(null); setQuery('') }}
        onCancel={() => setPicked(null)}
      />
    )
  }

  const usage = foodUsage(store.protein, localDate())
  const results = !foods ? [] : query.trim()
    ? searchFoods(foods.index, query, usage)
    : focused ? topFoods(usage).map((id) => foods.foodById(id)).filter((f): f is Food => !!f) : []

  // A recent food opens with the portion used last time
  function pick(food: Food) {
    const last = [...store.protein].reverse().find((e) => e.food_id === food.id)
    const portion = last ? (last.portion_label ? food.portions.find((p) => p.label === last.portion_label) ?? null : null) : defaultPortion(food)
    const qty = last && (portion ? last.portion_qty : last.portion_grams) || (portion ? 1 : 100)
    setPicked({ food, portion, qty })
  }

  return (
    <div className="card form">
      <input
        className="search" type="search" placeholder="Search food: roti, dal, paneer…" aria-label="Search food"
        autoComplete="off" enterKeyHint="search" value={query}
        onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {!query.trim() && focused && results.length > 0 && <span className="cap">Recent</span>}
      {results.length > 0 && (
        <div className="results">
          {results.map((f) => <Result key={f.id} food={f} onPick={pick} />)}
        </div>
      )}
      {query.trim() && foods && !results.length && <p className="cap empty">No match for “{query.trim()}”.</p>}
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setManual(true)}>
        {query.trim() && !results.length ? 'Type the numbers instead' : 'Or type protein and kcal'}
      </button>
    </div>
  )
}

function Result({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  const portion = defaultPortion(food)
  const n = nutrientsFor(food, portionGrams(portion, portion ? 1 : 100))
  const about = food.confidence === 'estimate'
  return (
    <button className="result" onClick={() => onPick(food)}>
      <span className="row-main">
        <span>{food.name} {about && <span className="about">about</span>}</span>
        <span className="cap" style={{ textAlign: 'left' }}>{portion?.label ?? '100 g'}</span>
      </span>
      <span className="cap">{n.grams} g · {n.kcal} kcal</span>
    </button>
  )
}

// Pick a portion and how many, see protein and kcal before saving. Used to log and to edit a logged food.
type PickerProps = Chosen & {
  submitLabel: string
  onSubmit: (n: Nutrients, ref: FoodRef) => void
  onCancel: () => void
  onDelete?: () => void
}

function PortionPicker({ food, portion: initialPortion, qty: initialQty, submitLabel, onSubmit, onCancel, onDelete }: PickerProps) {
  const [portion, setPortion] = useState<Portion | null>(initialPortion)
  const [qty, setQty] = useState(fmtQty(initialQty))
  const [saved, setSaved] = useState<string | null>(null)
  const q = toNum(qty)
  const step = portion ? QTY_STEP : GRAM_STEP
  const max = portion ? MAX_QTY : MAX_GRAMS
  const valid = Number.isFinite(q) && q > 0 && q <= max
  const grams = valid ? portionGrams(portion, q) : 0
  const n = nutrientsFor(food, grams)
  const ref = valid ? foodRef(food, portion, q) : null
  const about = food.confidence === 'estimate' ? 'about ' : ''
  const empty = valid && n.grams === 0 && n.kcal === 0

  function choose(p: Portion | null) {
    if (p === portion) return
    // Keep the amount roughly the same when switching between a household unit and grams
    const g = valid ? portionGrams(portion, q) : 0
    setPortion(p)
    setQty(fmtQty(p ? Math.max(QTY_STEP, Math.round((g / p.grams) / QTY_STEP) * QTY_STEP || 1) : Math.max(1, Math.round(g)) || 100))
    setSaved(null)
  }
  const bump = (d: number) => {
    const next = Math.round(((valid ? q : 0) + d * step) / step) * step
    setQty(fmtQty(Math.min(max, Math.max(step, next))))
    setSaved(null)
  }

  async function saveQuick() {
    if (!ref) return
    const name = `${food.name}, ${portionText(ref)}`.slice(0, 60)
    const err = await addQuickAdd(name, n, ref)
    setSaved(err ?? 'Saved as a one-tap food.')
  }

  return (
    <form className="card form" noValidate onSubmit={(e) => { e.preventDefault(); if (ref && !empty) onSubmit(n, ref) }}>
      <div className="card-top">
        <b>{food.name}</b>
        {about && <span className="about">about</span>}
      </div>

      <div className="chips" role="group" aria-label="Portion">
        {food.portions.map((p) => (
          <button key={p.label} type="button" className="chip portion" aria-pressed={portion === p} onClick={() => choose(p)}>
            {p.label} <span className="cap">{p.grams} g</span>
          </button>
        ))}
        <button type="button" className="chip portion" aria-pressed={portion === null} onClick={() => choose(null)}>grams</button>
      </div>

      <div className="qty-row">
        <span className="cap">{portion ? `How many × ${portion.label.replace(/^1\s+/, '')}` : 'How many grams'}</span>
        <div className="stepper">
          <button type="button" className="pm" aria-label="Less" onClick={() => bump(-1)}>−</button>
          <input className="weight num" inputMode="decimal" aria-label={portion ? 'Quantity' : 'Grams'} value={qty}
            onChange={(e) => { setQty(e.target.value); setSaved(null) }} />
          <button type="button" className="pm" aria-label="More" onClick={() => bump(1)}>+</button>
        </div>
      </div>

      {valid ? (
        <>
          <div className="food-preview" aria-live="polite">
            <span><span className="cap">{about}</span><span className="num tone-protein">{n.grams}</span> <span className="cap">g protein</span></span>
            <span><span className="cap">{about}</span><span className="num">{n.kcal}</span> <span className="cap">kcal</span></span>
          </div>
          <span className="cap">Carbs {n.carbs_g} g · fat {n.fat_g} g · {fmtQty(Math.round(grams))} g of food</span>
        </>
      ) : (
        <p className="err" role="alert">{portion ? `Enter how many, up to ${MAX_QTY}.` : `Enter grams, up to ${MAX_GRAMS}.`}</p>
      )}
      {empty && <p className="cap empty">That rounds to nothing. Add a bit more.</p>}

      <div className={onDelete ? 'three' : 'two'}>
        {onDelete && <button type="button" className="link danger" onClick={onDelete}>Delete</button>}
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={!valid || empty}>{submitLabel}</button>
      </div>
      {!onDelete && valid && !empty && (
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={saveQuick}>Save as one-tap food</button>
      )}
      {saved && <p className="cap" role="status" style={{ margin: 0 }}>{saved}</p>}
    </form>
  )
}

// Something not in the list: type protein (and calories if known)
function ManualForm({ initialLabel, onSearch }: { initialLabel: string; onSearch: () => void }) {
  const [label, setLabel] = useState(initialLabel.trim())
  const [grams, setGrams] = useState('')
  const [kcal, setKcal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmBig, setConfirmBig] = useState(false)

  function submit(e: React.FormEvent, force = false) {
    e.preventDefault()
    const g = grams.trim() ? toInt(grams) : 0
    const k = kcal.trim() ? toInt(kcal) : null
    if (!Number.isInteger(g) || g < 0) return setError('Enter protein as a whole number of grams.')
    if (k !== null && (!Number.isInteger(k) || k > 5000)) return setError('Enter kcal as a whole number up to 5000, or leave it empty.')
    if (g === 0 && !k) return setError('Enter protein grams or kcal.')
    if (g > 1000) return setError('One entry can be at most 1000 g of protein.')
    if (g > 300 && !force) return setConfirmBig(true)
    if (k === null) logProtein(g, label || null)
    else logFood({ grams: g, kcal: k, carbs_g: null, fat_g: null, food_id: null, portion_label: null, portion_qty: null, portion_grams: null, label: label || null })
    setLabel(''); setGrams(''); setKcal(''); setError(null); setConfirmBig(false)
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <input className="full" aria-label="What you ate (optional)" placeholder="What you ate (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="nums-row">
        <input id="grams" className="num" inputMode="numeric" placeholder="Protein g" aria-label="Grams of protein"
          value={grams} onChange={(e) => { setGrams(e.target.value); setError(null); setConfirmBig(false) }} />
        <input className="num" inputMode="numeric" placeholder="kcal" aria-label="Calories (optional)"
          value={kcal} onChange={(e) => { setKcal(e.target.value); setError(null) }} />
        <button className="btn" type="submit">Log</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {confirmBig && (
        <div className="confirm">
          <span>More than 300 g in one entry. Log it anyway?</span>
          <button type="button" className="btn ghost" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>Log {grams} g</button>
        </div>
      )}
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onSearch}>Search the food list instead</button>
    </form>
  )
}

// ---------- Today's entries ----------

function EntryRow({ entry }: { entry: ProteinEntry }) {
  const foods = useFoods()
  const [editing, setEditing] = useState(false)
  const food = foods?.foodById(entry.food_id)
  const about = food?.confidence === 'estimate' ? 'about ' : ''

  if (!editing) {
    const portion = portionText(entry)
    return (
      <button className="row" onClick={() => setEditing(true)}>
        <span className="row-main">
          <span>{entry.label ?? 'Protein'}</span>
          <span className="cap">{portion ? `${portion} · ` : ''}{timeOf(entry.logged_at)}</span>
        </span>
        <span className="row-nums">
          <span className="num">{about && <span className="cap">{about}</span>}{entry.grams} g</span>
          {entry.kcal != null && <span className="cap">{entry.kcal} kcal</span>}
        </span>
      </button>
    )
  }

  // A food from the list is edited by its portion, so protein and calories stay consistent
  if (food && entry.portion_grams) {
    const portion = entry.portion_label ? food.portions.find((p) => p.label === entry.portion_label) ?? null : null
    const qty = portion ? entry.portion_qty ?? 1 : entry.portion_grams
    return (
      <PortionPicker
        food={food} portion={portion} qty={qty} submitLabel="Save"
        onSubmit={(n, ref) => { updateEntry(entry.id, { ...n, ...ref }); setEditing(false) }}
        onCancel={() => setEditing(false)}
        onDelete={() => deleteProtein(entry.id)}
      />
    )
  }
  return <TypedEdit entry={entry} onClose={() => setEditing(false)} />
}

// Typed entries (and any food no longer in the list): edit the numbers directly
function TypedEdit({ entry, onClose }: { entry: ProteinEntry; onClose: () => void }) {
  const [grams, setGrams] = useState(String(entry.grams))
  const [kcal, setKcal] = useState(entry.kcal == null ? '' : String(entry.kcal))
  const [label, setLabel] = useState(entry.label ?? '')
  const [error, setError] = useState<string | null>(null)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const g = toInt(grams)
    const k = kcal.trim() ? toInt(kcal) : null
    if (!Number.isInteger(g) || g < 0 || g > 1000) return setError('Enter protein between 0 and 1000 g.')
    if (k !== null && (!Number.isInteger(k) || k > 5000)) return setError('Enter kcal up to 5000, or leave it empty.')
    if (g === 0 && !k) return setError('Enter protein grams or kcal.')
    // Changed numbers no longer match the food's carbs and fat
    const changed = g !== entry.grams || k !== entry.kcal
    updateEntry(entry.id, { grams: g, kcal: k, label: label || null, ...(changed ? { carbs_g: null, fat_g: null } : {}) })
    onClose()
  }

  return (
    <form className="card form" onSubmit={save} noValidate>
      <input className="full" aria-label="Label" placeholder="Protein" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="two">
        <input className="num" inputMode="numeric" aria-label="Grams of protein" value={grams} onChange={(e) => { setGrams(e.target.value); setError(null) }} />
        <input className="num" inputMode="numeric" aria-label="Calories (optional)" placeholder="kcal" value={kcal} onChange={(e) => { setKcal(e.target.value); setError(null) }} />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="three">
        <button type="button" className="link danger" onClick={() => deleteProtein(entry.id)}>Delete</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn">Save</button>
      </div>
    </form>
  )
}
