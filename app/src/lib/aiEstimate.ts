import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Calls the estimate-food Edge Function (supabase/functions/estimate-food) for a food that isn't in the list.
// Values are for the whole portion described. Always an estimate: shown as "AI estimate" with its assumptions.

export type AiEstimate = {
  name: string
  portion: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  added_sugar_g: number
  assumptions: string
  confidence: 'estimate'
}

export type AiResult = { ok: true; estimate: AiEstimate; cacheId: string | null } | { ok: false; message: string }

export async function estimateFood(query: string): Promise<AiResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, message: 'AI estimates need a connection. Type the numbers instead, or try again with signal.' }
  }
  const { data, error } = await supabase.functions.invoke('estimate-food', { body: { query } })
  if (error) {
    // The function explains refusals itself (daily limit, not a food, unsure); anything else is a connection problem
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        if (body?.message) return { ok: false, message: body.message }
      } catch { /* not JSON */ }
    }
    return { ok: false, message: 'Couldn’t reach AI estimates. Check your connection, or type the numbers.' }
  }
  return { ok: true, estimate: data.estimate as AiEstimate, cacheId: data.cache_id ?? null }
}

// Stored as the entry's food_id, so entries show "AI estimate" (prefixed like other non-dataset sources)
export const aiFoodId = (cacheId: string | null) => (cacheId ? `ai:${cacheId}` : 'ai:estimate')
export const isAiFood = (id: string | null) => !!id?.startsWith('ai:')
