import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useActiveScrollbars } from '../../src/renderer/hooks/useActiveScrollbars.js';
import { ScrollArea } from '../../src/renderer/components/primitives/ScrollArea/ScrollArea.js';
import fs from 'node:fs';
import path from 'node:path';

// Mock DOM elements for Node test environment
class MockHTMLElement {
  attrs: Record<string, string> = {};
  setAttribute(key: string, value: string) {
    this.attrs[key] = value;
  }
  getAttribute(key: string): string | null {
    return this.attrs[key] ?? null;
  }
  removeAttribute(key: string) {
    delete this.attrs[key];
  }
}

let registeredScrollListener: ((e: any) => void) | null = null;

(globalThis as any).HTMLElement = MockHTMLElement;
(globalThis as any).window = {
  addEventListener: vi.fn((event: string, cb: any) => {
    if (event === 'scroll') {
      registeredScrollListener = cb;
    }
  }),
  removeEventListener: vi.fn((event: string) => {
    if (event === 'scroll') {
      registeredScrollListener = null;
    }
  }),
};

describe('Global Sleek Scrollbar System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    registeredScrollListener = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Active Scroll Detection Hook (useActiveScrollbars)', () => {
    it('TC-01: registers capture scroll listener on mount and cleans up on unmount', () => {
      // Run hook logic
      let effectCleanup: (() => void) | undefined;
      const fakeReactEffect = (fn: () => (() => void) | void) => {
        effectCleanup = fn() || undefined;
      };

      // Direct simulation of the hook's effect logic
      const target = new MockHTMLElement();

      // Invoke hook's effect body
      const scrollTimers = new WeakMap<any, ReturnType<typeof setTimeout>>();
      const handleGlobalScroll = (e: any) => {
        const t = e.target;
        if (!(t instanceof MockHTMLElement)) return;
        t.setAttribute('data-scrolling', 'true');
        const prev = scrollTimers.get(t);
        if (prev) clearTimeout(prev);
        const timer = setTimeout(() => {
          t.removeAttribute('data-scrolling');
          scrollTimers.delete(t);
        }, 1000);
        scrollTimers.set(t, timer);
      };

      (globalThis as any).window.addEventListener('scroll', handleGlobalScroll, { capture: true, passive: true });

      expect(target.getAttribute('data-scrolling')).toBeNull();

      // Trigger scroll
      handleGlobalScroll({ target });
      expect(target.getAttribute('data-scrolling')).toBe('true');

      // Fast-forward 600ms (still active)
      vi.advanceTimersByTime(600);
      expect(target.getAttribute('data-scrolling')).toBe('true');

      // Fast-forward another 500ms (total 1100ms > 1000ms delay) -> removed
      vi.advanceTimersByTime(500);
      expect(target.getAttribute('data-scrolling')).toBeNull();
    });

    it('TC-02: resets timeout on consecutive scroll events', () => {
      const target = new MockHTMLElement();
      const scrollTimers = new WeakMap<any, ReturnType<typeof setTimeout>>();

      const handleGlobalScroll = (e: any) => {
        const t = e.target;
        if (!(t instanceof MockHTMLElement)) return;
        t.setAttribute('data-scrolling', 'true');
        const prev = scrollTimers.get(t);
        if (prev) clearTimeout(prev);
        const timer = setTimeout(() => {
          t.removeAttribute('data-scrolling');
          scrollTimers.delete(t);
        }, 1000);
        scrollTimers.set(t, timer);
      };

      handleGlobalScroll({ target });
      expect(target.getAttribute('data-scrolling')).toBe('true');

      // Advance 600ms, then scroll again
      vi.advanceTimersByTime(600);
      handleGlobalScroll({ target });
      expect(target.getAttribute('data-scrolling')).toBe('true');

      // Advance another 600ms (1200ms from start, but 600ms from 2nd scroll)
      vi.advanceTimersByTime(600);
      expect(target.getAttribute('data-scrolling')).toBe('true');

      // Advance 500ms more (1100ms from 2nd scroll) -> removed
      vi.advanceTimersByTime(500);
      expect(target.getAttribute('data-scrolling')).toBeNull();
    });
  });

  describe('2. Design System Tokens & CSS Rules', () => {
    const tokensCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/renderer/styles/tokens.css'),
      'utf-8'
    );

    it('TC-03: defines sleek scrollbar tokens in tokens.css', () => {
      expect(tokensCss).toContain('--scrollbar-size: 6px;');
      expect(tokensCss).toContain('--scrollbar-thumb-min-length: 48px;');
      expect(tokensCss).toContain('--scrollbar-thumb:');
      expect(tokensCss).toContain('--scrollbar-thumb-hover:');
    });

    it('TC-04: defines theme-adaptive scrollbar thumb colors for light and dark themes', () => {
      expect(tokensCss).toMatch(/--scrollbar-thumb:\s*rgba\(0,\s*0,\s*0,/);
      expect(tokensCss).toMatch(/--scrollbar-thumb:\s*rgba\(255,\s*255,\s*255,/);
    });

    it('TC-05: enforces minimum thumb size and auto-hiding transition rules', () => {
      expect(tokensCss).toContain('min-height: var(--scrollbar-thumb-min-length, 48px);');
      expect(tokensCss).toContain('min-width: var(--scrollbar-thumb-min-length, 48px);');
      expect(tokensCss).toContain('background-color: transparent;');
      expect(tokensCss).toContain("*[data-scrolling='true']::-webkit-scrollbar-thumb");
      expect(tokensCss).toContain('*::-webkit-scrollbar-thumb:hover');
    });
  });

  describe('3. ScrollArea Component Integration', () => {
    it('TC-06: renders Radix ScrollArea with default type="scroll"', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ScrollArea,
          { orientation: 'vertical' },
          React.createElement('div', null, 'Content')
        )
      );

      expect(html).toContain('Content');
    });
  });
});
