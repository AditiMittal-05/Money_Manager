import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,       // frontend always runs at http://localhost:5173
    strictPort: true  // error instead of silently jumping to 5174, 5175, 5176...
  }
})
