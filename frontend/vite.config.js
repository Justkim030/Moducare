import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base: '/static/'` makes the built assets resolve under Django's
// STATIC_URL, so `frontend/dist` (added to STATICFILES_DIRS) is served
// directly by the Django dev server.
export default defineConfig({
  plugins: [react()],
  base: '/static/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
