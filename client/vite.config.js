import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Ignorar desconexiones normales del cliente al refrescar la página
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) return
            console.error('[proxy ws error]', err.message)
          })
        },
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
