export interface AccentPreset {
  name: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Royal Blue', hex: '#1B88FF' },
  { name: 'Emerald', hex: '#27AE60' },
  { name: 'Coral', hex: '#E74C3C' },
  { name: 'Violet', hex: '#8E44AD' },
  { name: 'Amber', hex: '#F39C12' },
  { name: 'Rose', hex: '#E91E8C' },
  { name: 'Teal', hex: '#1ABC9C' },
  { name: 'Slate', hex: '#64748B' },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (val: number) => Math.max(0, Math.min(255, Math.round(val + (val * percent) / 100)));
  const r = adjust(rgb.r).toString(16).padStart(2, '0');
  const g = adjust(rgb.g).toString(16).padStart(2, '0');
  const b = adjust(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Applies runtime accent color and computes derived tokens:
 * --accent, --accent-hover, --accent-active, --accent-muted, --accent-border
 */
export function applyAccentColor(hex: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const validHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#1B88FF';
  const rgb = hexToRgb(validHex) || { r: 27, g: 136, b: 255 };

  const hover = adjustBrightness(validHex, -10);
  const active = adjustBrightness(validHex, -20);
  const muted = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
  const border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`;

  root.style.setProperty('--accent', validHex);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-active', active);
  root.style.setProperty('--accent-muted', muted);
  root.style.setProperty('--accent-border', border);
  root.style.setProperty('--surface-selected', muted);
  root.style.setProperty('--surface-active', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.07)`);
  root.style.setProperty('--text-link', validHex);
}

/**
 * Applies theme attribute to <html> element ('dark' or 'light')
 */
export function applyTheme(theme: 'light' | 'dark' | 'auto' | 'system', effectiveTheme?: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  let finalTheme: 'light' | 'dark' = 'light';
  if (theme === 'dark' || theme === 'light') {
    finalTheme = theme;
  } else if (effectiveTheme) {
    finalTheme = effectiveTheme;
  } else {
    // Check OS preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    finalTheme = prefersDark ? 'dark' : 'light';
  }

  if (finalTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

/**
 * Applies UI density ('compact', 'comfortable', 'spacious')
 */
export function applyDensity(density: 'compact' | 'comfortable' | 'spacious'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-density', density);
  if (density === 'compact') {
    root.style.setProperty('--task-row-height', '36px');
    root.style.setProperty('--task-row-gap', 'var(--space-1)');
  } else if (density === 'spacious') {
    root.style.setProperty('--task-row-height', '52px');
    root.style.setProperty('--task-row-gap', 'var(--space-3)');
  } else {
    root.style.setProperty('--task-row-height', '44px');
    root.style.setProperty('--task-row-gap', 'var(--space-2)');
  }
}

/**
 * Applies font size scale ('sm' | 'md' | 'lg' or custom px number)
 */
export function applyFontSize(size: string | number): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let basePx = 14;

  if (size === 'sm') basePx = 13;
  else if (size === 'lg') basePx = 16;
  else if (typeof size === 'number') basePx = Math.max(12, Math.min(20, size));
  else if (!isNaN(Number(size))) basePx = Math.max(12, Math.min(20, Number(size)));

  root.style.setProperty('--text-base', `${basePx}px`);
  root.style.setProperty('--text-sm', `${basePx - 1.5}px`);
  root.style.setProperty('--text-xs', `${basePx - 3}px`);
  root.style.setProperty('--text-lg', `${basePx + 2}px`);
  root.style.setProperty('--text-xl', `${basePx + 5}px`);
}

/**
 * Applies font family
 */
export function applyFontFamily(fontFamily: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!fontFamily || fontFamily === 'Inter') {
    root.style.removeProperty('--font-sans');
  } else {
    root.style.setProperty('--font-sans', fontFamily);
  }
}
