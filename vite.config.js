import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/cctv/',
  server: {
    proxy: {
      '/cctv/api': 'http://localhost:5000'
    }
  }
})
