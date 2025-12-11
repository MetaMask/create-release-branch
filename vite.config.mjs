import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/ui/app',
  build: {
    outDir: '../../../dist/ui/build',
    emptyOutDir: true,
  },
});
