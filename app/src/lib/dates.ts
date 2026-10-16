// Dates are the user's local calendar days as 'YYYY-MM-DD' strings (never UTC),
// so "today" follows the phone's clock.

export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

// Monday of the week containing `iso`
export function weekStart(iso: string): string {
  const day = (parse(iso).getDay() + 6) % 7 // Mon = 0 … Sun = 6
  return addDays(iso, -day)
}

export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i))

export const fmtDay = (iso: string) => parse(iso).toLocaleDateString('en-GB', { weekday: 'short' })
export const fmtDate = (iso: string) => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
