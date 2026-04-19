import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://canido.today',
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
