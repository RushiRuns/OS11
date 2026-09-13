# ADR-0006: CSS Modules with CSS Variable Design Tokens over Runtime CSS-in-JS

## Status
Accepted

## Context
OS11's visual identity relies on a refined, minimalist aesthetic ("FEEL UI") with instant, jitter-free rendering. The styling system must support:
- Instant theme switching (Light Mode, Dark Mode, High Contrast) without re-rendering the component tree
- Scoped component styles that avoid accidental selector collisions
- Zero runtime JavaScript overhead during animations, scrolling, and user interactions
- Strict design consistency using central tokens

### Evaluated Alternatives
1. **Runtime CSS-in-JS (e.g. `styled-components`, `@emotion/react`):**
   - *Why Banned:*
     - Runtime overhead: Generates, hashes, and injects `<style>` tags into the DOM during React render cycles.
     - Causes memory churn and triggers JavaScript garbage collection pauses, producing noticeable micro-stutters during 60fps/120fps scrolling.
     - Dynamic style recalculation on theme changes forces deep component tree reconciliation.
     - Adds significant bundle weight (~12-16KB gzipped).
2. **Tailwind CSS:**
   - *Evaluation:* Imposes utility class verbosity directly in JSX templates, making complex component DOM trees difficult to read. Lacks native component encapsulation and introduces class name clutter that conflicts with our headless Radix primitive ejected structure.
3. **CSS Modules + Pure CSS Variables (`tokens.css`):**
   - *Evaluation:*
     - Zero runtime JavaScript overhead: CSS is extracted into static `.css` files at build time by Vite.
     - Scoped class names (`Button_button__a1b2c`) prevent style leakage.
     - Full dynamic flexibility via CSS Custom Properties (`var(--surface-base)`, `var(--accent)`).
     - Instant dark mode: toggling `data-theme="dark"` on `<html>` updates every surface and text color in a single browser paint frame without invoking React.

## Decision
1. We choose **CSS Modules** (`*.module.css`) paired with **CSS Variable Design Tokens** (`src/renderer/styles/tokens.css`) as the exclusive styling architecture.
2. Runtime CSS-in-JS libraries (`styled-components`, `emotion`) are **strictly banned**.
3. All styling rules must consume tokens from `tokens.css`. Hardcoded hex colors, arbitrary pixel dimensions, and ad-hoc shadows are prohibited and enforced via code review and linter.

## Consequences
- **Positive:**
  - True 0ms runtime style computation cost.
  - Near-instant theme transitions via native CSS cascade.
  - Predictable, clean component separation between layout structure (TSX) and styling presentation (CSS Module).
- **Negative / Considerations:**
  - Dynamic styles dependent on arbitrary runtime calculations (e.g. fractional progress percentages) must use inline CSS variables (`style={{ '--progress': `${pct}%` } as React.CSSProperties}`) rather than inline style properties.
