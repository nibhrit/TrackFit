import { useState } from 'react'
import { addStarterFoods, logQuickAdd, useStore } from '../data/store'
import { STARTER_FOODS } from '../data/types'

// One-tap food logging (protein, and calories when the saved food has them).
// On an empty list, offers a starter set of common foods.
export default function QuickAdds({ offerStarters = false }: { offerStarters?: boolean }) {
  const { quickAdds, loaded } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!quickAdds.length) {
    if (!offerStarters || !loaded) return null
    return (
      <div className="card form">
        <b>Save foods you eat often</b>
        <p className="cap" style={{ margin: 0 }}>
          Adds {STARTER_FOODS.length} common foods as one-tap buttons, like a whey scoop (24 g protein, 120 kcal) and 3 eggs (18 g, 215 kcal).
          Values are approximate. Edit them under Saved foods.
        </p>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" disabled={busy} onClick={async () => { setBusy(true); setError(await addStarterFoods()); setBusy(false) }}>
          {busy ? 'Adding…' : `Add ${STARTER_FOODS.length} common foods`}
        </button>
      </div>
    )
  }

  return (
    <div className="chips scroll" role="group" aria-label="Quick add food">
      {quickAdds.map((q) => (
        <button key={q.id} className="chip food" onClick={() => logQuickAdd(q)}>
          + {q.name} <b>{q.grams} g</b>
        </button>
      ))}
    </div>
  )
}
