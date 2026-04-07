/**
 * Shared scroll configuration — consistent trigger positioning across all components.
 * Reads header dimensions from CSS custom properties so it adapts to resize/orientation.
 */

export function getHeaderOffset(): number {
  if (typeof window === 'undefined') return 104; // SSR fallback: 64 + 40
  const style = getComputedStyle(document.documentElement);
  return (parseInt(style.getPropertyValue('--header-height')) || 64)
       + (parseInt(style.getPropertyValue('--topbar-height')) || 40);
}
