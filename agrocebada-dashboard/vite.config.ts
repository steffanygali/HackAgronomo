import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite abrir dist/index.html desde cualquier ruta estática
// (incluido file://) sin configurar rewrites del servidor.
export default defineConfig({
  base: './',
  plugins: [react()],
});
