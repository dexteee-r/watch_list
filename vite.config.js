import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Sépare les gros vendors en chunks dédiés : mieux mis en cache (ils
        // changent rarement) et chargés en parallèle. L'ordre compte — le nom
        // de paquet `@phosphor-icons/react` et `react-router` contiennent "react".
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('@phosphor-icons')) return 'icons'
          if (id.includes('react-router') || id.includes('react-dom')) return 'react'
          if (id.includes('/react/')) return 'react'
        },
      },
    },
  },
  server: {
    // En dev, l'app (5173) appelle l'API FastAPI (8000) via ce proxy → même origine,
    // le cookie de session fonctionne, pas de CORS. En prod, c'est nginx qui route /api.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
