import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Tirzah backend. `tirzah serve` defaults to port 8765. Override with
// VITE_TIRZAH_API. All /api calls (including the SSE trace stream) proxy here.
const TIRZAH_API = process.env.VITE_TIRZAH_API || 'http://localhost:8765'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: TIRZAH_API, changeOrigin: true },
    },
  },
})
