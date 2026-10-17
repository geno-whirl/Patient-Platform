import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages sirve el sitio en /<repo>/; el workflow define BASE_PATH=/Patient-Platform/.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
