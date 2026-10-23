import { useContext, useState } from 'react'
import {
  deleteProtein, foodsWithoutKcal, goalFor, kcalEatenOn, kcalGoalFor, logFood, logProtein, proteinOn, updateEntry, useStore,
} from '../data/store'
import Header from '../components/Header'
import { NO_FOOD, NO_NUTRIENTS, type ProteinEntry } from '../data/types'
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

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
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
      footer={<button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setManual(true)}>Or type protein and kcal</button>}
    />
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
    else logFood({ grams: g, ...NO_NUTRIENTS, kcal: k, ...NO_FOOD, label: label || null })
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
  const ai = isAiFood(entry.food_id)
  const about = food?.confidence === 'estimate' || ai ? 'about ' : ''

  if (!editing) {
    const portion = portionText(entry)
    return (
      <button className="row" onClick={() => setEditing(true)}>
        <span className="row-main">
          <span>{entry.label ?? 'Protein'}</span>
          <span className="cap">{ai ? 'AI estimate · ' : ''}{portion ? `${portion} · ` : ''}{timeOf(entry.logged_at)}</span>
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
    // Changed numbers no longer match the food's other nutrients
    const changed = g !== entry.grams || k !== entry.kcal
    updateEntry(entry.id, { grams: g, kcal: k, label: label || null, ...(changed ? { ...NO_NUTRIENTS, kcal: k } : {}) })
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
      {!entry.food_id && (
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setLinking(true)}>
          Link to a food{entry.kcal == null ? ' (adds calories and macros)' : ''}
        </button>
      )}
    </form>
  )
}
