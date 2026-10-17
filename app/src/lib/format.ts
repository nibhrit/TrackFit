import type { LiftSet } from '../data/types'

// 60 → "60", 62.5 → "62.5", 62.50 → "62.5"
export const fmtWeight = (n: number) => String(Math.round(n * 100) / 100)

// "60 60 65 kg" when all sets share a unit, else "20 kg 45 lb"
export function fmtSets(sets: LiftSet[]): string {
  if (!sets.length) return ''
  const same = sets.every((s) => s.unit === sets[0].unit)
  return same
    ? `${sets.map((s) => fmtWeight(s.weight)).join('  ')} ${sets[0].unit}`
    : sets.map((s) => `${fmtWeight(s.weight)} ${s.unit}`).join('  ')
}
