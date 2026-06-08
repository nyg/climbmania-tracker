import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy Climbmania requests to avoid CORS in dev
    proxy: {
      '/climbmania': {
        target: 'https://www.climbmania.ch',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/climbmania/, ''),
        secure: true,
      }
    }
  }
})
