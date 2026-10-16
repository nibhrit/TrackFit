import { useEffect, useState } from 'react'
import { loadSplits, splitFor, toggleSplit, useStore } from '../data/store'
import { GROUPS } from '../data/types'
import { addDays, fmtDate, fmtDay, localDate, weekDays, weekStart } from '../lib/dates'

export default function PlanWeek({ onBack }: { onBack: () => void }) {
  const store = useStore()
  const today = localDate()
  const [start, setStart] = useState(() => weekStart(today))
  const [openDay, setOpenDay] = useState<string | null>(null)
  const days = weekDays(start)
  const isThisWeek = start === weekStart(today)

  // Weeks outside the range loaded at startup are fetched when you arrive on them
  useEffect(() => { loadSplits(start, addDays(start, 6)) }, [start])

  const status = (d: string) => (d === today ? 'Today' : d < today ? null : 'Planned')
  const empty = (d: string) => (d < today ? 'Rest' : d === today ? 'Not picked yet' : 'Not planned')

  return (
    <>
      <button className="link back" onClick={onBack}>‹ Lift</button>
      <div className="hdr">
        <h1>Plan week</h1>
        <span className="cap">{fmtDate(days[0])} to {fmtDate(days[6])}</span>
      </div>

      <div className="week-nav">
        <button className="btn ghost" onClick={() => { setStart(addDays(start, -7)); setOpenDay(null) }} aria-label="Previous week">‹ Previous</button>
        {!isThisWeek && <button className="link" onClick={() => { setStart(weekStart(today)); setOpenDay(null) }}>This week</button>}
        <button className="btn ghost" onClick={() => { setStart(addDays(start, 7)); setOpenDay(null) }} aria-label="Next week">Next ›</button>
      </div>

      <div className="list">
        {days.map((d) => {
          const groups = splitFor(store, d)
          const isOpen = openDay === d
          return (
            <div key={d} className={`day-card${d === today ? ' today' : ''}${d < today ? ' past' : ''}`}>
              <button className="day-head" aria-expanded={isOpen} onClick={() => setOpenDay(isOpen ? null : d)}>
                <span className="day-name">
                  <b>{fmtDay(d)}</b> <span className="cap">{fmtDate(d)}</span>
                  {status(d) && groups.length > 0 && <span className="tag">{status(d)}</span>}
                  {d === today && !groups.length && <span className="tag">Today</span>}
                </span>
                <span className={groups.length ? 'day-groups' : 'cap'}>
                  {groups.length ? GROUPS.filter((g) => groups.includes(g)).join(', ') : empty(d)}
                </span>
              </button>
              {isOpen && (
                <div className="chips day-edit" role="group" aria-label={`Muscle groups for ${fmtDay(d)} ${fmtDate(d)}`}>
                  {GROUPS.map((g) => (
                    <button key={g} className="chip" aria-pressed={groups.includes(g)} onClick={() => toggleSplit(g, d)}>{g}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="cap" style={{ margin: 0 }}>Tap a day to change it. A planned day becomes that day’s split on the Lift page.</p>
    </>
  )
}
