import { useContext, useState } from 'react'
import {
  deleteProtein, foodsWithoutKcal, goalFor, kcalEatenOn, kcalGoalFor, logFood, proteinOn, updateEntry, useStore,
} from '../data/store'
import Header from '../components/Header'
import { NO_FOOD, type Nutrients, type ProteinEntry } from '../data/types'
import { localDate } from '../lib/dates'
import { portionText } from '../lib/nutrition'
import { isAiFood } from '../lib/aiEstimate'
import { useFoods } from '../lib/useFoods'
import { SettingsContext } from '../lib/settingsContext'
import ProteinSummary from '../components/ProteinRing'
import QuickAdds from '../components/QuickAdds'
import FoodFinder, { PortionPicker } from '../components/FoodFinder'
import MacrosPanel from '../components/MacrosPanel'

// The Food tab (was "Protein"): protein ring + calories, one-tap saved foods, search the food list, today's entries.

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function Protein() {
  const store = useStore()
  const today = localDate()
  const entries = [...proteinOn(store, today)].reverse()
  const [macros, setMacros] = useState(false)
  const openSettings = useContext(SettingsContext)
  const unlinked = foodsWithoutKcal(store).length

  return (
    <>
      <Header title="Food" aside={`Goal ${goalFor(store, today)} g`} />
      <div className="card">
        <ProteinSummary>
          <button className="btn ghost small macros-btn" aria-expanded={macros} onClick={() => setMacros(!macros)}>{macros ? 'Hide macros' : 'Macros'}</button>
        </ProteinSummary>
        <KcalLine />
        {macros && <MacrosPanel />}
      </div>
      <QuickAdds offerStarters />
      {unlinked > 0 && (
        <p className="cap nudge">
          {unlinked === 1 ? '1 saved food has' : `${unlinked} saved foods have`} no calories ·{' '}
          <button className="link small" onClick={openSettings}>Fix</button>
        </p>
      )}
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

// ---------- Adding food: search the list (or ask AI), or type the numbers ----------

function AddFood() {
  const [manual, setManual] = useState(false)
  if (manual) return <ManualForm initialLabel="" onSearch={() => setManual(false)} />
  return (
    <FoodFinder
      submitLabel="Log" saveQuick
      onDone={(n, ref, name) => logFood({ ...n, ...ref, label: name })}
      footer={<button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setManual(true)}>Or type the numbers (from a label)</button>}
    />
  )
}

// Something not in the list (e.g. from a pack label): type what you know. Protein or kcal required, the rest optional.
function ManualForm({ initialLabel, onSearch }: { initialLabel: string; onSearch: () => void }) {
  const [label, setLabel] = useState(initialLabel.trim())
  const [vals, setVals] = useState<Vals>(toVals())
  const [error, setError] = useState<string | null>(null)
  const [confirmBig, setConfirmBig] = useState(false)

  function submit(e: React.FormEvent, force = false) {
    e.preventDefault()
    const r = readVals(vals)
    if ('error' in r) return setError(r.error)
    if (r.n.grams > 300 && !force) return setConfirmBig(true)
    logFood({ ...r.n, ...NO_FOOD, label: label || null })
    setLabel(''); setVals(toVals()); setError(null); setConfirmBig(false)
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <input className="full" aria-label="What you ate (optional)" placeholder="What you ate (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <NutrientFields vals={vals} onChange={(v) => { setVals(v); setError(null); setConfirmBig(false) }} />
      <p className="cap note">Leave a box empty if you don’t know it. Pack labels list these per serving.</p>
      {error && <p className="err" role="alert">{error}</p>}
      {confirmBig && (
        <div className="confirm">
          <span>More than 300 g of protein in one entry. Log it anyway?</span>
          <button type="button" className="btn ghost" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>Log it</button>
        </div>
      )}
      <div className="two">
        <button type="button" className="btn ghost" onClick={onSearch}>Search instead</button>
        <button className="btn" type="submit">Log</button>
      </div>
    </form>
  )
}

// ---------- Nutrient fields (typed entries and edits) ----------

// Protein and kcal first; the rest optional. Empty = unknown (stays out of totals, flagged in Macros).
const FIELDS: [keyof Nutrients, string, number][] = [
  ['grams', 'Protein g', 1000], ['kcal', 'kcal', 5000], ['carbs_g', 'Carbs g', 1000],
  ['fat_g', 'Fat g', 1000], ['fiber_g', 'Fibre g', 300], ['added_sugar_g', 'Sugar g', 1000],
]
type Vals = Record<keyof Nutrients, string>
const toVals = (n?: Partial<Nutrients>): Vals =>
  Object.fromEntries(FIELDS.map(([k]) => [k, n?.[k] == null ? '' : String(n[k])])) as Vals

// Parse the boxes: whole numbers (the database stores whole grams), empty optional fields become null
function readVals(v: Vals): { n: Nutrients } | { error: string } {
  const out: Record<string, number | null> = {}
  for (const [k, label, max] of FIELDS) {
    const raw = v[k].trim().replace(',', '.')
    if (!raw) { out[k] = k === 'grams' ? 0 : null; continue }
    const x = Math.round(Number(raw))
    if (!Number.isFinite(Number(raw)) || x < 0 || x > max) return { error: `Check ${label.toLowerCase()} (0 to ${max}).` }
    out[k] = x
  }
  if (out.grams === 0 && !out.kcal) return { error: 'Enter protein grams or kcal.' }
  return { n: out as Nutrients }
}

function NutrientFields({ vals, onChange }: { vals: Vals; onChange: (v: Vals) => void }) {
  return (
    <div className="ai-grid">
      {FIELDS.map(([k, label]) => (
        <label key={k} className={k === 'grams' ? 'tone-protein' : undefined}>
          <span className="cap">{label}</span>
          <input className="num" inputMode="decimal" aria-label={label} placeholder="–" value={vals[k]} onChange={(e) => onChange({ ...vals, [k]: e.target.value })} />
        </label>
      ))}
    </div>
  )
}

// One line of macros under an entry, e.g. "C 82 · F 28 · fibre 8 · sugar 0 g"
function macroLine(e: ProteinEntry) {
  const parts = [
    e.carbs_g != null && `C ${e.carbs_g}`, e.fat_g != null && `F ${e.fat_g}`,
    e.fiber_g != null && `fibre ${e.fiber_g}`, e.added_sugar_g != null && `sugar ${e.added_sugar_g}`,
  ].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} g` : null
}

// ---------- Today's entries ----------

function EntryRow({ entry }: { entry: ProteinEntry }) {
  const foods = useFoods()
  const [editing, setEditing] = useState(false)
  const food = foods?.foodById(entry.food_id)
  const ai = isAiFood(entry.food_id)
  const about = food?.confidence === 'estimate' || ai ? 'about ' : ''

  if (!editing) {
    const portion = portionText(entry)
    return (
      <button className="row" onClick={() => setEditing(true)}>
        <span className="row-main">
          <span>{entry.label ?? 'Protein'}</span>
          <span className="cap">{ai ? 'AI estimate · ' : ''}{portion ? `${portion} · ` : ''}{timeOf(entry.logged_at)}</span>
          {macroLine(entry) && <span className="cap">{macroLine(entry)}</span>}
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

// Typed entries (and AI estimates, or a food no longer in the list): edit the numbers directly,
// or link the entry to a food from the list so it gets calories and macros
function TypedEdit({ entry, onClose }: { entry: ProteinEntry; onClose: () => void }) {
  const [linking, setLinking] = useState(false)
  const [vals, setVals] = useState<Vals>(toVals(entry))
  const [label, setLabel] = useState(entry.label ?? '')
  const [error, setError] = useState<string | null>(null)

  // Every number is editable, so editing one no longer throws the others away
  function save(e: React.FormEvent) {
    e.preventDefault()
    const r = readVals(vals)
    if ('error' in r) return setError(r.error)
    updateEntry(entry.id, { ...r.n, label: label || null })
    onClose()
  }

  if (linking) {
    return (
      <FoodFinder
        initialQuery={entry.label ?? ''} submitLabel="Link"
        note={`Was ${entry.grams} g protein${entry.kcal != null ? `, ${entry.kcal} kcal` : ', no calories'}. Linking replaces it with the food’s values.`}
        onDone={(n, ref, name) => { updateEntry(entry.id, { ...n, ...ref, label: name }); onClose() }}
        onCancel={() => setLinking(false)}
      />
    )
  }

  return (
    <form className="card form" onSubmit={save} noValidate>
      <input className="full" aria-label="Label" placeholder="Protein" value={label} onChange={(e) => setLabel(e.target.value)} />
      <NutrientFields vals={vals} onChange={(v) => { setVals(v); setError(null) }} />
      {error && <p className="err" role="alert">{error}</p>}
      <div className="three">
        <button type="button" className="link danger" onClick={() => deleteProtein(entry.id)}>Delete</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn">Save</button>
      </div>
      {!entry.food_id && (
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setLinking(true)}>
          Link to a food{entry.kcal == null ? ' (adds calories and macros)' : ''}
        </button>
      )}
    </form>
  )
}
