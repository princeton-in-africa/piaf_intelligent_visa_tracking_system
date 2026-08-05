import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Relative asset paths mean `npm run build` produces a dist/ folder that can
  // be opened directly from the filesystem (or served from any sub-path),
  // rather than only working when hosted at a domain root.
  base: './',

  build: {
    // Recharts (and the d3 modules it pulls in) is by far the largest
    // dependency. Splitting it into its own chunk keeps the shell's JS small,
    // so navigation and the tables stay responsive independently of charts.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'charts'
          }
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
