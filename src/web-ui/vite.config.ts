import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  optimizeDeps: {
    esbuildOptions: { target: 'chrome87' },
  },
  build: {
    target: 'chrome87',
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '^/api/': {
        target: 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
})
