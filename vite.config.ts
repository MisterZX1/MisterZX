import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sets the base path to relative, ensuring assets load correctly
  // regardless of the directory structure on Netlify.
  base: './',
});