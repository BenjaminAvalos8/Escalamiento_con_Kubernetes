import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
      '/health-difusion': {
        target: 'http://localhost:4000',
        rewrite: () => '/health',
      },
      '/api': {
        target: 'http://localhost:3000',
      },
      '/health-eventos': {
        target: 'http://localhost:3000',
        rewrite: () => '/health',
      },
      '/metrics': {
        target: 'http://localhost:3000',
      },
    },
  },
})
