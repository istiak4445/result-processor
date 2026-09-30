import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

let tailwindcss;
try {
  tailwindcss = (await import('@tailwindcss/vite')).default;
} catch {}

export default defineConfig({
  plugins: [react(), ...(tailwindcss ? [tailwindcss()] : [])],
});
