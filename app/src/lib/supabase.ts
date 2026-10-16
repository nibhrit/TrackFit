import { createClient } from '@supabase/supabase-js'

// Both values are public by design: the publishable key only grants what
// row-level security allows (see supabase/migrations).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy app/.env.example to app/.env.')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit flow: the sign-in link works even when the email app opens it
    // in a different browser from the one that requested it.
    flowType: 'implicit',
  },
})

// Where the sign-in link returns to: this app's own address (local or GitHub Pages).
export const appUrl = () => window.location.origin + import.meta.env.BASE_URL
