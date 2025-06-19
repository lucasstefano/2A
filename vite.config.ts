import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/2A/', // o nome exato do repositório no GitHub
  plugins: [react()],
})
