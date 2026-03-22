/**
 * Get the base URL for asset paths.
 * Reads from <meta name="base-url"> set by BaseLayout.astro.
 * Works on both GitHub Pages (/perfectpools-redesign/) and Vercel (/).
 */
export function getBaseUrl(): string {
  if (typeof document === 'undefined') return '/';
  const meta = document.querySelector('meta[name="base-url"]');
  return meta?.getAttribute('content') || '/';
}

/**
 * Prefix an asset path with the base URL.
 * e.g. assetPath('/images/foo.svg') → '/perfectpools-redesign/images/foo.svg'
 */
export function assetPath(path: string): string {
  const base = getBaseUrl();
  // Remove leading slash from path since base already ends with /
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}
