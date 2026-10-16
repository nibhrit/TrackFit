import { defineConfig } from '@vite-pwa/assets-generator/config'

// Generates PNG app icons (Android, iPhone home screen, maskable) from one full-bleed SVG.
// Run: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#1D2227' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1D2227' } },
  },
  images: ['public/icon-source.svg'],
})
