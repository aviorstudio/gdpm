// @ts-check
import { defineConfig } from 'astro/config';

import qwikdev from '@qwikdev/astro';

import vercel from '@astrojs/vercel';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  redirects: {
    '/[username]': {
      status: 301,
      destination: '/@[username]',
    },
    '/[username]/[plugin]': {
      status: 301,
      destination: '/@[username]/[plugin]',
    },
    '/[username]/account': {
      status: 301,
      destination: '/@[username]/account',
    },
  },
  integrations: [qwikdev()],
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()]
  }
});
