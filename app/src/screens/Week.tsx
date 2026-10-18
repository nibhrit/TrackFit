import { useState } from 'react'
import {
  bodyKg, deleteWeight, goalFor, habitsOn, kcalOn, logWeight, loggedOn, proteinTotal, streak, useStore,
} from '../data/store'
import Header from '../components/Header'
import type { BodyWeight, HabitKey, Unit } from '../data/types'
import { addDays, fmtDate, fmtDay, localDate, weekDays, weekStart } from '../lib/dates'
import { fmtWeight } from '../lib/format'
import TrendChart from '../components/TrendChart'

export default function Week() {
  const store = useStore()
  const today = localDate()
  const days = weekDays(weekStart(today))
  const sofar = days.filter((d) => d <= today)
  const count = (fn: (d: string) => boolean) => sofar.filter(fn).length
  const proteinHits = count((d) => proteinTotal(store, d) >= goalFor(store, d))
  const run = streak(store)

  return (
    <>
      <Header title="Week" aside={`${fmtDate(days[0])} to ${fmtDate(days[6])}`} />

      <div className="tiles four">
        <Tile n={count((d) => loggedOn(store, d))} label={run > 1 ? `days logged · ${run}-day streak` : 'days logged'} tone="lift" />
        <Tile n={proteinHits} label="protein goal hit" tone="protein" />
        <Tile n={count((d) => habitsOn(store, d).sugar === 'avoided')} label="no sugar" tone="habit" />
        <Tile n={count((d) => habitsOn(store, d).junk_food === 'avoided')} label="no junk food" tone="habit" />
      </div>

      <HabitGrid days={days} today={today} />
      <p className="cap legend">Filled: avoided · Ring: had it · Dashed: not logged</p>

      <ProteinCard />
      <KcalCard days={days} today={today} />
      <BodyWeightCard />
    </>
  )
}

function Tile({ n, label, tone }: { n: number; label: string; tone: 'lift' | 'protein' | 'habit' }) {
  return (
    <div className="tile">
      <span className={`num tile-num tone-${tone}`}>{n}<span className="tile-of">/7</span></span>
      <span className="cap">{label}</span>
    </div>
  )
}

type DotState = 'on' | 'off' | 'ok' | 'had' | 'none' | 'future'

// One grid instead of three cards: a row each for Logged, Sugar and Junk food
function HabitGrid({ days, today }: { days: string[]; today: string }) {
  const store = useStore()
  const habitState = (d: string, key: HabitKey): DotState => {
    if (d > today) return 'future'
    const v = habitsOn(store, d)[key]
    return v === 'avoided' ? 'ok' : v === 'had' ? 'had' : 'none'
  }
  const rows: [string, (d: string) => DotState][] = [
    ['Logged', (d) => (d > today ? 'future' : loggedOn(store, d) ? 'on' : 'off')],
    ['Sugar', (d) => habitState(d, 'sugar')],
    ['Junk', (d) => habitState(d, 'junk_food')],
  ]
  return (
    <div className="card grid-week" role="table" aria-label="This week by day">
      <span role="columnheader" />
      {days.map((d) => (
        <span key={d} role="columnheader" className={`cap gw-day${d === today ? ' today' : ''}`}>{fmtDay(d).slice(0, 1)}</span>
      ))}
      {rows.map(([label, state]) => (
        <div key={label} role="row" style={{ display: 'contents' }}>
          <span role="rowheader" className="cap gw-label">{label}</span>
          {days.map((d) => (
            <span key={d} role="cell" className={`mini ${state(d)}`} title={`${label}, ${fmtDate(d)}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Estimated calories burnt per day this week, in graphite (blue/yellow/green are taken)
function KcalCard({ days, today }: { days: string[]; today: string }) {
  const store = useStore()
  const [active, setActive] = useState(today)
  const rows = days.map((d) => ({ d, ...kcalOn(store, d) }))
  const max = Math.max(1, ...rows.map((r) => r.total)) * 1.1
  const shown = rows.find((r) => r.d === active)!
  const week = rows.reduce((s, r) => s + r.total, 0)
  return (
    <div className="card form">
      <div className="card-top">
        <b>Calories burnt</b>
        <span className="cap">about {week} kcal this week</span>
      </div>
      <span className="cap">
        <span className="trend-read">{fmtDate(shown.d)}: <b>about {shown.total} kcal</b></span>
        {shown.total > 0 && ` · cardio ${shown.cardio}, lifting ${shown.lifting}`}
      </span>
      <div className="bars kcal" role="img" aria-label={`Estimated calories burnt per day this week, about ${week} in total`}>
        {rows.map((r) => (
          <button key={r.d} className={`bar-hit${r.d === shown.d ? ' active' : ''}`} disabled={r.d > today}
            aria-label={`${fmtDate(r.d)}: about ${r.total} kcal`} onClick={() => setActive(r.d)}>
            <span className="bar" style={{ height: `${r.d > today ? 0 : Math.max(2, (r.total / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="bar-lbl">{rows.map((r) => <span key={r.d}>{fmtDay(r.d).slice(0, 2)}</span>)}</div>
      <span className="cap">Estimates{bodyKg(store).estimated ? ', using 70 kg until you log your weight' : ''}. Lifting counts about 3 minutes per set.</span>
    </div>
  )
}

function ProteinCard() {
  const store = useStore()
  const today = localDate()
  const [range, setRange] = useState<7 | 30>(7)
  const [active, setActive] = useState<string | null>(null)
  const days = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1))
  const rows = days.map((d) => ({ d, total: proteinTotal(store, d), goal: goalFor(store, d) }))
  const hits = rows.filter((r) => r.total >= r.goal).length
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.goal))) * 1.1
  const goalNow = goalFor(store, today)
  const shown = rows.find((r) => r.d === active) ?? rows[rows.length - 1]

  return (
    <div className="card form">
      <div className="card-top">
        <b>Protein per day</b>
        <div className="seg small" role="group" aria-label="Range">
          <button className="pick" aria-pressed={range === 7} onClick={() => { setRange(7); setActive(null) }}>7 days</button>
          <button className="pick" aria-pressed={range === 30} onClick={() => { setRange(30); setActive(null) }}>30 days</button>
        </div>
      </div>
      <span className="cap"><span className="trend-read">{fmtDate(shown.d)}: <b>{shown.total} g</b></span> of {shown.goal} g · goal hit {hits} of {range} days</span>
      <div className={`bars${range === 30 ? ' dense' : ''}`} role="img" aria-label={`Protein per day, last ${range} days. Goal hit on ${hits} days.`}>
        {rows.map((r) => (
          <button
            key={r.d} className={`bar-hit${r.total >= r.goal ? ' hit' : ''}${r.d === shown.d ? ' active' : ''}`}
            aria-label={`${fmtDate(r.d)}: ${r.total} of ${r.goal} grams`}
            onClick={() => setActive(r.d)}
          >
            <span className="bar" style={{ height: `${Math.max(2, (r.total / max) * 100)}%` }} />
          </button>
        ))}
        <div className="goal-line" style={{ bottom: `${(goalNow / max) * 100}%` }}><span>{goalNow} g goal</span></div>
      </div>
      {range === 7 && (
        <div className="bar-lbl">{rows.map((r) => <span key={r.d}>{fmtDay(r.d).slice(0, 2)}</span>)}</div>
      )}
    </div>
  )
}

const LB = 0.45359237
const convert = (w: BodyWeight, to: Unit) => (w.unit === to ? w.weight : to === 'kg' ? w.weight * LB : w.weight / LB)

function BodyWeightCard() {
  const store = useStore()
  const today = localDate()
  const unit = store.settings.body_weight_unit
  const todays = store.weights.find((w) => w.date === today)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<30 | 90>(30)

  const latest = store.weights[store.weights.length - 1]
  // Change vs the closest entry on or before 30 days ago
  const base = [...store.weights].reverse().find((w) => w.date <= addDays(today, -30))
  const change = latest && base ? convert(latest, unit) - convert(base, unit) : null
  const points = store.weights
    .filter((w) => w.date >= addDays(today, -range + 1))
    .map((w) => ({ date: w.date, label: fmtDate(w.date), value: convert(w, unit) }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(value.replace(',', '.'))
    if (!value.trim() || !Number.isFinite(n) || n <= 0 || n >= 700) return setError('Enter your weight, e.g. 78.4')
    logWeight(Math.round(n * 10) / 10, unit)
    setValue('')
    setError(null)
  }

  return (
    <section className="group">
      <h2 className="sec">Body weight</h2>
      <div className="card form">
        {latest ? (
          <div className="hdr">
            <div><span className="num big">{fmtWeight(Math.round(convert(latest, unit) * 10) / 10)}</span> <span className="cap">{unit}, {latest.date === today ? 'today' : fmtDate(latest.date)}</span></div>
            {change !== null && <span className="cap">{change > 0 ? '+' : change < 0 ? '−' : ''}{fmtWeight(Math.abs(Math.round(change * 10) / 10))} {unit} in 30 days</span>}
          </div>
        ) : (
          <span className="cap">Log your weight to start the chart. Unit is in Settings.</span>
        )}

        <form className="entry-row" onSubmit={submit} noValidate>
          <input id="body-weight" className="num" inputMode="decimal" aria-label={`Body weight in ${unit}`}
            placeholder={unit === 'kg' ? '78.4' : '172.8'}
            value={value} onChange={(e) => { setValue(e.target.value); setError(null) }} />
          <button className="btn" type="submit">{todays ? 'Update' : 'Log'}</button>
        </form>
        {error && <p className="err" role="alert">{error}</p>}
        {todays && (
          <button className="link danger" onClick={() => deleteWeight(today)}>Delete today’s weight</button>
        )}
      </div>

      {points.length >= 2 ? (
        <div className="card form">
          <div className="seg small" role="group" aria-label="Chart range" style={{ alignSelf: 'flex-end' }}>
            <button className="pick" aria-pressed={range === 30} onClick={() => setRange(30)}>30 days</button>
            <button className="pick" aria-pressed={range === 90} onClick={() => setRange(90)}>90 days</button>
          </div>
          <TrendChart points={points} unit={unit} caption="Body weight" tone="neutral" />
        </div>
      ) : latest ? (
        <div className="card cap">The chart appears after your second weigh-in{range === 30 ? ' in the last 30 days' : ''}.</div>
      ) : null}
    </section>
  )
}
