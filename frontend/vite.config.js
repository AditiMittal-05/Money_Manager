import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — tells Vite to use the React plugin
// so it can understand JSX (HTML inside JavaScript)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173   // frontend runs at http://localhost:5173
  }
})
