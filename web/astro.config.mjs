// @ts-check
import { defineConfig } from 'astro/config';

import qwikdev from '@qwikdev/astro';

import vercel from '@astrojs/vercel';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [qwikdev()],
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()]
  }
});