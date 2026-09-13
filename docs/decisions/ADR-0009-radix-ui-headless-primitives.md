# ADR-0009: Use Radix UI Headless Primitives (via shadcn/ui scaffold) for Accessible Components

## Status
Accepted

## Context
OS11 requires several interactive UI components — context menus, popovers, dialogs, tooltips, collapsible sections, and scroll areas — that must be fully keyboard-navigable and meet WAI-ARIA accessibility standards.

Building these correctly from scratch requires implementing focus trapping, keyboard event handling (`Escape`, arrow keys, `Tab`), ARIA role management, and portal rendering. This is substantial, error-prone work, and mistakes create real accessibility failures.

Three categories of alternatives were evaluated:

1. **Pre-styled component systems** (MUI, Ant Design, Chakra UI): Provide accessibility but impose a visual design system that conflicts with OS11's token-based CSS Modules approach. Bundle weight is unjustifiable for components that would require style overrides on every element. Rejected.

2. **Custom implementations from scratch**: Achievable but a significant distraction from product development. Focus-trap implementations in particular have well-documented edge cases across browsers and screen readers. Rejected.

3. **Headless primitive libraries** (Radix UI, Headless UI): Provide the accessibility behaviour with zero visual opinions. OS11 owns 100% of the styling. Radix UI was chosen over Headless UI for its wider primitive set (Popover, ScrollArea) and more active maintenance.

Separately, a review of animation library usage identified that **Framer Motion** was described broadly in early documentation but in practice is only needed at 4 specific interaction sites. All other transitions are achievable — and more performant — via CSS `transition` + `--ease-*` tokens. Restricting Framer Motion to 4 sites reduces bundle complexity and prevents motion from becoming decorative.

## Decision

1. **Adopt Radix UI** (installed individually from `@radix-ui/*`) as the accessibility primitive layer. Scaffold with `npx shadcn@latest init` (Tailwind disabled; CSS Variables selected). Eject all component code into `src/renderer/components/`. Style exclusively with CSS Modules + `tokens.css` variables.

2. **Approved Radix primitives** (only these six, for now):

   | Package | OS11 use |
   |---|---|
   | `@radix-ui/react-dropdown-menu` | Right-click task context menus |
   | `@radix-ui/react-popover` | Date, tag, and priority pickers |
   | `@radix-ui/react-dialog` | Delete confirmations, Settings modal |
   | `@radix-ui/react-collapsible` | Sidebar section collapse / expand |
   | `@radix-ui/react-scroll-area` | Task list and sidebar scrolling |
   | `@radix-ui/react-tooltip` | Keyboard shortcut hints |

3. **Framer Motion is restricted to 4 use-sites:**

   | # | Feature | Motion type |
   |---|---|---|
   | 1 | Checkbox completion | Spring bounce + line-through |
   | 2 | Detail panel open/close | Spring slide-in from right |
   | 3 | Task list reorder | `layoutId` layout animation during drag |
   | 4 | Quick-add bar appear/dismiss | Scale + opacity |

   Any new use of `framer-motion` outside these sites requires a new ADR.

4. **Banned libraries** (do not add; no ADR can re-open without founder sign-off):
   - `@mui/material`, `@ant-design/`, `@chakra-ui/react` — pre-styled, conflicts with token system.
   - `gsap` — overkill; commercial licence for some plugins; 4-site Framer Motion restriction makes it redundant.
   - `react-spring` — Framer Motion is the chosen animation library; two patterns are not permitted.

## Consequences

- **Positive**:
  - WAI-ARIA compliance for all interactive overlays without custom focus-trap implementations.
  - Zero visual bleed from Radix — all styles are CSS Modules authored by the OS11 team.
  - Framer Motion restriction keeps the animation surface small and auditable.
  - Preact migration path exists: `motion` (`motion.dev`) is a drop-in replacement for Framer Motion with the same API.
- **Negative / Considerations**:
  - Radix primitives add `@radix-ui/*` packages to `node_modules`. Each is small (~5–15KB gzipped). Monitor with `vite-bundle-analyzer`.
  - The shadcn scaffold step must be run with Tailwind disabled — verify in CI that no Tailwind classes appear in committed component files.
  - Adding a new Radix primitive in future (beyond the 6 listed) requires updating `DEPENDENCIES.md` and this ADR.
