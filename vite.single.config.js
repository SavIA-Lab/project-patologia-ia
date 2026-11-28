import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/* Un solo archivo HTML con los dos idiomas, para uso sin conexión (npm run build:single).
 * No se publica como adjunto de una versión: la salida va a dist-single/ y está en .gitignore. */
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single', target: 'es2022', assetsInlineLimit: 100000000, cssCodeSplit: false }
});
