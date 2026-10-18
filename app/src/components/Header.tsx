import { useContext } from 'react'
import { SettingsContext } from '../lib/settingsContext'

type Props = { title: string; aside?: React.ReactNode; action?: React.ReactNode }

// The one header used on every tab: title, optional note, optional action, Settings
export default function Header({ title, aside, action }: Props) {
  const openSettings = useContext(SettingsContext)
  return (
    <div className="hdr">
      <h1>{title}</h1>
      <span className="hdr-right">
        {aside && <span className="cap">{aside}</span>}
        {action}
        <button className="icon-btn" aria-label="Settings" onClick={openSettings}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
          </svg>
        </button>
      </span>
    </div>
  )
}
