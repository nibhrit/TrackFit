import { useState } from 'react'
import { addQuickAdd, useStore } from '../data/store'
import type { FoodRef, Nutrients } from '../data/types'
import type { Food, Portion } from '../data/foods/schema'
import { localDate } from '../lib/dates'
import { foodUsage, searchRanked, topFoods } from '../lib/foodSearch'
import {
  GRAM_STEP, MAX_GRAMS, MAX_QTY, QTY_STEP, defaultPortion, fmtQty, foodRef, nutrientsFor, portionGrams, portionText,
} from '../lib/nutrition'
import { aiFoodId, estimateFood, type AiEstimate } from '../lib/aiEstimate'
import { useFoods } from '../lib/useFoods'

// Find a food and say how much: search the food list (or ask for an AI estimate when it isn't there),
// pick a portion, see the nutrients, then submit. Used to log food, and to link a saved food or an old entry to a food.

const toNum = (v: string) => (/^\d+([.,]\d+)?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : NaN)

// A match this weak (contains / typo) or none at all offers an AI estimate
const WEAK = 3
const MIN_AI_QUERY = 3

type Chosen = { food: Food; portion: Portion | null; qty: number }

type FinderProps = {
  initialQuery?: string
  submitLabel: string
  onDone: (n: Nutrients, ref: FoodRef, name: string) => void
  onCancel?: () => void       // shows Cancel on the search itself (when linking)
  note?: React.ReactNode      // shown above the numbers once a food is picked, e.g. what it replaces
  saveQuick?: boolean         // offer "Save as one-tap food"
  footer?: React.ReactNode
}

export default function FoodFinder({ initialQuery = '', submitLabel, onDone, onCancel, note, saveQuick, footer }: FinderProps) {
  const store = useStore()
  const foods = useFoods()
  const [query, setQuery] = useState(initialQuery)
  const [focused, setFocused] = useState(false)
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [ai, setAi] = useState<{ estimate: AiEstimate; cacheId: string | null } | null>(null)
  const [aiState, setAiState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const done = (n: Nutrients, ref: FoodRef, name: string) => { onDone(n, ref, name); setPicked(null); setAi(null); setQuery('') }

  if (picked) {
    return (
      <PortionPicker {...picked} submitLabel={submitLabel} note={note} saveQuick={saveQuick}
        onSubmit={(n, ref) => done(n, ref, picked.food.name)} onCancel={() => setPicked(null)} />
    )
  }
  if (ai) {
    return (
      <AiCard {...ai} submitLabel={submitLabel} note={note} saveQuick={saveQuick}
        onSubmit={(n, ref, name) => done(n, ref, name)} onCancel={() => setAi(null)} />
    )
  }

  const usage = foodUsage(store.protein, localDate())
  const q = query.trim()
  const ranked = foods && q ? searchRanked(foods.index, query, usage) : []
  const results = !foods ? [] : q
    ? ranked.map((h) => h.food)
    : focused ? topFoods(usage).map((id) => foods.foodById(id)).filter((f): f is Food => !!f) : []
  const offerAi = !!foods && q.length >= MIN_AI_QUERY && (!ranked.length || ranked[0].score >= WEAK)

  // A recent food opens with the portion used last time
  function pick(food: Food) {
    const last = [...store.protein].reverse().find((e) => e.food_id === food.id)
    const portion = last ? (last.portion_label ? food.portions.find((p) => p.label === last.portion_label) ?? null : null) : defaultPortion(food)
    const qty = last && (portion ? last.portion_qty : last.portion_grams) || (portion ? 1 : 100)
    setPicked({ food, portion, qty })
  }

  async function askAi() {
    setAiState({ busy: true, error: null })
    const r = await estimateFood(q)
    if (r.ok) { setAi({ estimate: r.estimate, cacheId: r.cacheId }); setAiState({ busy: false, error: null }) }
    else setAiState({ busy: false, error: r.message })
  }

  return (
    <div className="card form">
      <input
        className="search" type="search" placeholder="Search food: roti, dal, paneer…" aria-label="Search food"
        autoComplete="off" enterKeyHint="search" value={query}
        onChange={(e) => { setQuery(e.target.value); setAiState({ busy: false, error: null }) }}
        onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {!q && focused && results.length > 0 && <span className="cap">Recent</span>}
      {results.length > 0 && (
        <div className="results">
          {results.map((f) => <Result key={f.id} food={f} onPick={pick} />)}
        </div>
      )}
      {q && foods && !results.length && <p className="cap empty">No match for “{q}” in the food list.</p>}
      {offerAi && (
        <button type="button" className="btn ghost" disabled={aiState.busy} onClick={askAi}>
          {aiState.busy ? 'Estimating…' : `Estimate “${q.length > 28 ? `${q.slice(0, 27)}…` : q}” with AI`}
        </button>
      )}
      {aiState.error && <p className="err" role="alert">{aiState.error}</p>}
      {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      {footer}
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

// One line of the other nutrients, leaving out what the dataset doesn't have
function restLine(n: Nutrients, grams: number) {
  return [
    `Carbs ${n.carbs_g} g`, `fat ${n.fat_g} g`,
    n.fiber_g != null && `fibre ${n.fiber_g} g`, n.added_sugar_g != null && `added sugar ${n.added_sugar_g} g`,
    `${fmtQty(Math.round(grams))} g of food`,
  ].filter(Boolean).join(' · ')
}

function SaveQuick({ name, n, ref }: { name: string; n: Nutrients; ref: FoodRef }) {
  const [saved, setSaved] = useState<string | null>(null)
  return (
    <>
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }}
        onClick={() => setSaved(addQuickAdd(name.slice(0, 60), n, ref) ?? 'Saved as a one-tap food.')}>
        Save as one-tap food
      </button>
      {saved && <p className="cap" role="status" style={{ margin: 0 }}>{saved}</p>}
    </>
  )
}

// Pick a portion and how many, see protein and kcal before saving. Used to log, to link, and to edit a logged food.
type PickerProps = Chosen & {
  submitLabel: string
  onSubmit: (n: Nutrients, ref: FoodRef) => void
  onCancel: () => void
  onDelete?: () => void
  note?: React.ReactNode
  saveQuick?: boolean
}

export function PortionPicker({ food, portion: initialPortion, qty: initialQty, submitLabel, onSubmit, onCancel, onDelete, note, saveQuick }: PickerProps) {
  const [portion, setPortion] = useState<Portion | null>(initialPortion)
  const [qty, setQty] = useState(fmtQty(initialQty))
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
  }
  const bump = (d: number) => {
    const next = Math.round(((valid ? q : 0) + d * step) / step) * step
    setQty(fmtQty(Math.min(max, Math.max(step, next))))
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
            onChange={(e) => setQty(e.target.value)} />
          <button type="button" className="pm" aria-label="More" onClick={() => bump(1)}>+</button>
        </div>
      </div>

      {note && <p className="cap note">{note}</p>}
      {valid ? (
        <>
          <div className="food-preview" aria-live="polite">
            <span><span className="cap">{about}</span><span className="num tone-protein">{n.grams}</span> <span className="cap">g protein</span></span>
            <span><span className="cap">{about}</span><span className="num">{n.kcal}</span> <span className="cap">kcal</span></span>
          </div>
          <span className="cap">{restLine(n, grams)}</span>
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
      {saveQuick && ref && !empty && <SaveQuick name={`${food.name}, ${portionText(ref)}`} n={n} ref={ref} />}
    </form>
  )
}

// ---------- AI estimate ----------

const AI_FIELDS: [keyof Nutrients | 'portion_grams', string, number][] = [
  ['portion_grams', 'Food g', 3000], ['kcal', 'kcal', 5000], ['grams', 'Protein g', 1000], ['carbs_g', 'Carbs g', 1000],
  ['fat_g', 'Fat g', 1000], ['fiber_g', 'Fibre g', 300], ['added_sugar_g', 'Sugar g', 1000],
]

type AiProps = {
  estimate: AiEstimate
  cacheId: string | null
  submitLabel: string
  onSubmit: (n: Nutrients, ref: FoodRef, name: string) => void
  onCancel: () => void
  note?: React.ReactNode
  saveQuick?: boolean
}

// The AI's numbers, labelled as an estimate with its assumptions, all editable before logging
function AiCard({ estimate: e, cacheId, submitLabel, onSubmit, onCancel, note, saveQuick }: AiProps) {
  const [name, setName] = useState(e.name)
  const [vals, setVals] = useState<Record<string, string>>(() => ({
    kcal: String(e.kcal), grams: String(Math.round(e.protein_g)), carbs_g: String(Math.round(e.carbs_g)), fat_g: String(Math.round(e.fat_g)),
    fiber_g: String(Math.round(e.fiber_g)), added_sugar_g: String(Math.round(e.added_sugar_g)), portion_grams: String(e.grams),
  }))
  const num = (k: string) => toNum(vals[k] ?? '')
  const bad = AI_FIELDS.find(([k, , max]) => !(num(k) >= 0 && num(k) <= max))
  const error = bad ? `Check ${bad[1].toLowerCase()} (0 to ${bad[2]}).`
    : num('portion_grams') < 1 ? 'Enter how many grams of food.'
    : !name.trim() ? 'Enter a name.'
    : num('grams') === 0 && num('kcal') === 0 ? 'Enter protein or kcal.' : null
  const r = (k: string) => Math.round(num(k))
  const n: Nutrients = { grams: r('grams'), kcal: r('kcal'), carbs_g: r('carbs_g'), fat_g: r('fat_g'), fiber_g: r('fiber_g'), added_sugar_g: r('added_sugar_g') }
  const ref: FoodRef = { food_id: aiFoodId(cacheId), portion_label: null, portion_qty: null, portion_grams: r('portion_grams') }

  return (
    <form className="card form" noValidate onSubmit={(ev) => { ev.preventDefault(); if (!error) onSubmit(n, ref, name.trim()) }}>
      <div className="card-top">
        <span className="about">AI estimate</span>
        <span className="cap">{e.portion}</span>
      </div>
      <input className="full" aria-label="Name" value={name} onChange={(ev) => setName(ev.target.value)} />
      <p className="cap note">Assumed: {e.assumptions} Check the numbers; edit any you know better.</p>
      {note && <p className="cap note">{note}</p>}
      <div className="ai-grid">
        {AI_FIELDS.map(([k, label]) => (
          <label key={k} className={k === 'grams' ? 'tone-protein' : undefined}>
            <span className="cap">{label}</span>
            <input className="num" inputMode="decimal" aria-label={label} value={vals[k]} onChange={(ev) => setVals({ ...vals, [k]: ev.target.value })} />
          </label>
        ))}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="two">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={!!error}>{submitLabel}</button>
      </div>
      {saveQuick && !error && <SaveQuick name={name.trim()} n={n} ref={ref} />}
    </form>
  )
}
