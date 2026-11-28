import { defineConfig } from 'vite';

/* Despliegue en GitHub Pages: https://savia-lab.github.io/project-patologia-ia/ */
export default defineConfig({
  base: '/project-patologia-ia/',
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  server: { port: 5173 },
  preview: { port: 4173 }
});
