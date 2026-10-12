/**
 * Pure utility functions (no I/O, no side effects per ARCHITECTURE.md).
 */

export * from './date.js';
export * from './uuid.js';
export * from './tag-shape.js';

export function toIsoString(date: Date = new Date()): string {
  return date.toISOString();
}

export function isValidIsoDate(str: string): boolean {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.includes('T');
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  const trimmed = str.trimStart();
  const leadingSpaces = str.slice(0, str.length - trimmed.length);
  if (!trimmed) return str;
  return leadingSpaces + trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
