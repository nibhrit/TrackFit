import { useContext } from 'react'
import { bodyKg, fitnessGoal, kcalGoalFor, macrosOn, useStore, type MacroKey } from '../data/store'
import { FITNESS_GOALS } from '../data/types'
import { localDate } from '../lib/dates'
import { macroTargets, suggestedKcal, type Target } from '../lib/macros'
import { SettingsContext } from '../lib/settingsContext'

// Today's macros vs targets for the chosen goal. Protein in yellow, everything else graphite.
// Added sugar is a limit: under it is good, so its bar is a "used up" bar, with the 5% ideal marked.

const GOAL_PHRASE = { lose_fat: 'fat loss', maintain: 'maintenance', build_muscle: 'muscle gain' } as const

type Row = { key: MacroKey; label: string; unit: string; target: Target | null }

export default function MacrosPanel() {
  const store = useStore()
  const openSettings = useContext(SettingsContext)
  const today = localDate()
  const goal = fitnessGoal(store)
  const kcal = kcalGoalFor(store, today)
  const { kg, estimated } = bodyKg(store)
  const t = macroTargets(goal, kcal, kg)
  const eaten = macrosOn(store, today)
  const rows: Row[] = [
    { key: 'kcal', label: 'Calories', unit: 'kcal', target: t.kcal },
    { key: 'grams', label: 'Protein', unit: 'g', target: t.protein },
    { key: 'carbs_g', label: 'Carbs', unit: 'g', target: t.carbs },
    { key: 'fat_g', label: 'Fat', unit: 'g', target: t.fat },
    { key: 'fiber_g', label: 'Fibre', unit: 'g', target: t.fiber },
    { key: 'added_sugar_g', label: 'Added sugar', unit: 'g', target: t.sugar },
  ]
  const goalName = FITNESS_GOALS.find(([id]) => id === goal)![1]
  const unknown = Math.max(...rows.slice(2).map((r) => eaten[r.key].missing))

  return (
    <div className="macros" role="region" aria-label="Macros today">
      <div className="hdr">
        <span className="cap">Goal: <b className="ink">{goalName}</b> · {Math.round(kg)} kg{estimated ? ' (default until you log weight)' : ''}</span>
        <button className="link small" onClick={openSettings}>Change</button>
      </div>
      {rows.map((r) => <MacroRow key={r.key} row={r} eaten={eaten[r.key].total} />)}
      {!kcal && (
        <p className="cap note">
          Set a calorie target in Settings to see carbs, fat and sugar targets. For {GOAL_PHRASE[goal]},
          about {suggestedKcal(goal, kg)} kcal is a rough starting point.
        </p>
      )}
      {unknown > 0 && <p className="cap note">{unknown === 1 ? '1 entry has' : `${unknown} entries have`} no carbs, fat or fibre data, so those totals are low. Link them to a food to fix.</p>}
    </div>
  )
}

function MacroRow({ row: { key, label, unit, target }, eaten }: { row: Row; eaten: number }) {
  const protein = key === 'grams'
  if (!target) {
    return (
      <div className="macro-row">
        <span className="macro-label">{label}</span>
        <span className="cap"><span className="num ink">{eaten}</span> {unit}</span>
      </div>
    )
  }
  const range = target.high ? `${target.value}–${target.high}` : `${target.value}`
  const left = target.value - eaten
  const status = target.kind === 'max'
    ? (eaten <= target.value ? `${left} ${unit} under limit` : `${-left} ${unit} over limit`)
    : target.kind === 'min'
      ? (left > 0 ? `${left} ${unit} to go` : 'reached')
      : (Math.abs(left) <= target.value * 0.05 ? 'on target' : left > 0 ? `${left} ${unit} left` : `${-left} ${unit} over`)
  const full = Math.max(target.high ?? target.value, 1)
  return (
    <div className="macro-row">
      <span className="macro-label">{label}</span>
      <span className="cap">
        <span className={`num ${protein ? 'tone-protein' : 'ink'}`}>{eaten}</span>
        {' '}/ {target.kind === 'max' ? 'max ' : target.kind === 'min' ? 'min ' : ''}{range} {unit}
      </span>
      <span className={`meter${protein ? ' protein' : ''}`} role="img" aria-label={`${label}: ${eaten} of ${range} ${unit}, ${status}`}>
        <span style={{ width: `${Math.min(eaten / full, 1) * 100}%` }} />
        {target.ideal != null && <i className="tick" style={{ left: `${(target.ideal / full) * 100}%` }} />}
      </span>
      <span className="cap macro-status">{status}{target.ideal != null ? ` · ideal under ${target.ideal} ${unit}` : ''}</span>
    </div>
  )
}
