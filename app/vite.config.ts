import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/TrackFit/ on GitHub Pages
export default defineConfig({
  base: '/TrackFit/',
  plugins: [react()],
})
