import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PISIGNAGE_API = process.env.PISIGNAGE_API ?? 'http://localhost:3000'

export default defineConfig({
  // App is served under /v2/ when bundled into pisignage-server (Path B
  // deployment — co-exists with the legacy AngularJS UI at /).
  base: '/v2/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: PISIGNAGE_API, changeOrigin: true },
      '/newsocket.io': { target: PISIGNAGE_API, changeOrigin: true, ws: true },
      '/media': { target: PISIGNAGE_API, changeOrigin: true },
      '/sync_folders': { target: PISIGNAGE_API, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
