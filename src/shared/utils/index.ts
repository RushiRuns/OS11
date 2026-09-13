/**
 * Pure utility functions (no I/O, no side effects per ARCHITECTURE.md).
 */

export * from './date.js';
export * from './uuid.js';

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
