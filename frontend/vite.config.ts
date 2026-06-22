import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // MapLibre GL is an inherently large dependency but is now an on-demand chunk
    // (loaded only on map routes via React.lazy), so we raise the warning ceiling
    // above its ~1MB size rather than masking a genuine initial-bundle regression.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})
