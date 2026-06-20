import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/climbmania-tracker/',
  plugins: [react()],
  server: {
    port: 3000,
  },
})
