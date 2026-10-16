import { useState } from 'react'
import { appUrl, supabase } from '../lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendEmail(e?: React.FormEvent) {
    e?.preventDefault()
    const addr = (sentTo ?? email).trim()
    if (!EMAIL_RE.test(addr)) return setError('Enter a valid email address.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: appUrl() } })
    setBusy(false)
    if (error) return setError(friendly(error.message))
    setSentTo(addr)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return setError('Enter the code from the email.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: sentTo!, token, type: 'email' })
    setBusy(false)
    if (error) setError('That code didn’t work. Check it, or send a new email.')
  }

  return (
    <div className="signin">
      <div className="signin-brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="56" height="56" />
        <h1>TrackFit</h1>
        <p className="cap">Last weights, protein and daily habits, on your phone and laptop.</p>
      </div>

      {!sentTo ? (
        <form className="card form" onSubmit={sendEmail} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }}
          />
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in email'}</button>
          <p className="cap">No password. We’ll email you a link and a code.</p>
        </form>
      ) : (
        <form className="card form" onSubmit={verifyCode} noValidate>
          <p style={{ margin: 0 }}>Email sent to <b>{sentTo}</b>.</p>
          <p className="cap" style={{ margin: 0 }}>Open the link in it, or type the code here. Use the code if you added TrackFit to your home screen.</p>
          <label htmlFor="code">Code</label>
          <input
            id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={10}
            className="num code" value={code} onChange={(e) => { setCode(e.target.value); setError(null) }}
          />
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="row-actions">
            <button type="button" className="link" onClick={() => sendEmail()} disabled={busy}>Send a new email</button>
            <button type="button" className="link" onClick={() => { setSentTo(null); setCode(''); setError(null) }}>Use another email</button>
          </div>
        </form>
      )}
    </div>
  )
}

function friendly(msg: string) {
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many emails sent. Wait a few minutes, then try again.'
  return 'Couldn’t send the email. Check your connection and try again.'
}
