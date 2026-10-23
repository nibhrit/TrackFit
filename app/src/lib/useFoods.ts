import { useEffect, useState } from 'react'

// Loads the food dataset on first use and keeps it for the rest of the session.
// null while loading (a few milliseconds from the PWA cache).
type Foods = typeof import('../data/foods')

let loaded: Foods | null = null
const load = () => import('../data/foods').then((m) => (loaded = m))

export function useFoods(): Foods | null {
  const [foods, setFoods] = useState(loaded)
  useEffect(() => { if (!foods) load().then(setFoods) }, [foods])
  return foods
}
