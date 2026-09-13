export function getRadixPortalContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('radix-portal');
}
