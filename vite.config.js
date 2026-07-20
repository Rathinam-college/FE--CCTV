import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.BACKEND_URL || 'http://localhost:5000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/cctv/',
  server: {
    host: true,
    port: 1573,
    proxy: {
      '/cctv/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/cctv/media': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  }
})
