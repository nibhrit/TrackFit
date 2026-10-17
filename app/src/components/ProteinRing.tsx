import { goalFor, proteinTotal, useStore } from '../data/store'
import { localDate } from '../lib/dates'

// Today's protein vs goal: yellow arc on a pale track, check mark once the goal is hit.
export default function ProteinSummary() {
  const store = useStore()
  const today = localDate()
  const total = proteinTotal(store, today)
  const goal = goalFor(store, today)
  const left = goal - total
  const C = 2 * Math.PI * 42
  const filled = Math.min(total / goal, 1) * C

  return (
    <div className="ring-row">
      <svg className="ring" width="96" height="96" viewBox="0 0 100 100" role="img" aria-label={`${total} of ${goal} grams of protein today`}>
        <circle cx="50" cy="50" r="42" className="ring-track" />
        <circle cx="50" cy="50" r="42" className="ring-fill" strokeDasharray={`${filled.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 50 50)" />
        {left <= 0 && <path d="M37 51l9 9 17-19" className="ring-check" />}
      </svg>
      <div>
        <div><span className="num big">{total}</span> <span className="cap">/ {goal} g protein</span></div>
        {left > 0 ? <div className="cap">{left} g to go today</div> : <div className="goal-hit">Goal hit</div>}
      </div>
    </div>
  )
}
