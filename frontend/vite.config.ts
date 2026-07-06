import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend runs on 8010 (8000 is often occupied by another local project).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5183, // dedicated port — 5173/5174 are used by other local apps
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
