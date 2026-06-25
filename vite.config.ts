import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Tirzah backend (uvicorn / `tirzah serve`). Override with VITE_TIRZAH_API.
// All /api calls (including the SSE trace stream) are proxied here in dev.
const TIRZAH_API = process.env.VITE_TIRZAH_API || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: TIRZAH_API, changeOrigin: true },
    },
  },
})
