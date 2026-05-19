import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel/serverless';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

// `output: 'static'` keeps every page as pre-rendered HTML by default.
// API routes under src/pages/api/ opt in to serverless via
// `export const prerender = false` at the top of each endpoint file.
export default defineConfig({
  site: isGitHubPages
    ? 'https://jeffspoolspa.github.io'
    : 'https://perfectpoolscleaning.com',
  base: isGitHubPages ? '/perfectpools-redesign/' : '/',
  integrations: [
    sitemap(),
    preact(),
  ],
  output: 'static',
  adapter: isGitHubPages ? undefined : vercel(),
});
