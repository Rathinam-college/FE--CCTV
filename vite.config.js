import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/cctv/',
  server: {
    proxy: {
      '/cctv/api': 'http://backend:5000',
      '/cctv/media': 'http://backend:5000'
    }
  }
})
