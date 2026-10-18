import { useState } from 'react'
import { deleteProtein, goalFor, logProtein, proteinOn, updateProtein, useStore } from '../data/store'
import Header from '../components/Header'
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
      <Header title="Protein" aside={`Goal ${goalFor(store, today)} g`} />
      <div className="card"><ProteinSummary /></div>
      <QuickAdds offerStarters />
      <LogForm quickAdds={store.quickAdds} />

      <h2 className="sec">Today’s entries</h2>
      {entries.length ? (
        <div className="list">{entries.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
      ) : (
        <p className="cap empty">Nothing logged yet today.</p>
      )}
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
    // Typing different grams after picking a food keeps the food's name as the label
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
    <form className="form" onSubmit={submit} noValidate>
      <div className="entry-row">
        {quickAdds.length > 0 && (
          <select id="food" aria-label="Choose food" value={food} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose food</option>
            {quickAdds.map((q) => <option key={q.id} value={q.id}>{q.name}, {q.grams} g</option>)}
          </select>
        )}
        <input id="grams" className="num" inputMode="numeric" placeholder="Grams" aria-label="Grams of protein"
          value={grams} onChange={(e) => { setGrams(e.target.value); setError(null); setConfirmBig(false) }} />
        <button className="btn" type="submit">Log</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {confirmBig && (
        <div className="confirm">
          <span>More than 300 g in one entry. Log it anyway?</span>
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

