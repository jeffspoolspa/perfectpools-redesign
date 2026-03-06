import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

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
});
