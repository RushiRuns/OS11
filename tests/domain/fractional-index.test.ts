import { describe, it, expect } from 'vitest';
import { between, atStart, atEnd } from '../../src/main/domain/fractional-index.js';

describe('Domain: Fractional Indexing', () => {
  it('should generate midpoints between two numbers', () => {
    expect(between(1000, 2000)).toBe(1500);
    expect(between(0, 1000)).toBe(500);
    expect(between(100, 150)).toBe(125);
  });

  it('should insert before first element with atStart', () => {
    expect(atStart(1000)).toBe(0);
    expect(atStart(0)).toBe(-1000);
    expect(between(null, 1000)).toBe(0);
  });

  it('should insert after last element with atEnd', () => {
    expect(atEnd(1000)).toBe(2000);
    expect(between(1000, null)).toBe(2000);
  });

  it('should handle null for both prev and next', () => {
    expect(between(null, null)).toBe(1000);
  });

  it('should handle equal values gracefully', () => {
    expect(between(100, 100)).toBe(100.5);
  });
});
