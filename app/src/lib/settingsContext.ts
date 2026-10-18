import { createContext } from 'react'

// Opens Settings from any screen's header
export const SettingsContext = createContext<() => void>(() => {})
