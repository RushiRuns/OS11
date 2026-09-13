# ADR-0003: Choose Zustand over Redux and React Context for Global State

## Status
Accepted

## Context
OS11 requires a responsive, low-latency state management solution in the React renderer. 
State operations include:
- Optimistic task mutations (completing, creating, reordering tasks instantly before IPC confirmation)
- Real-time active view and list navigation
- Detail panel synchronization
- Global shortcut orchestration and modal/dialog states

The solution must satisfy:
1. **Sub-16ms Frame Budget:** UI updates must not trigger broad subtree re-renders.
2. **Minimal Bundle Size:** Library code must be negligible.
3. **Out-of-Component Accessibility:** Stores must be accessible and mutable from imperative callbacks, IPC listeners, and utility functions outside the React component render cycle.
4. **Zero Boilerplate:** Clean, ergonomic developer experience without complex action/reducer ceremony.

### Evaluated Alternatives
1. **React Context API:**
   - *Why Banned:* Any change to a context value triggers an automatic re-render of **all** consumer components in the subtree, regardless of whether they consume the modified property. In a high-density task manager with hundreds of task rows and complex detail panels, updating a single task status triggers cascading re-renders across the entire task list, completely destroying our 60fps/120fps smooth scrolling and interaction goals.
   - *Rule:* React Context is banned for global and feature-level application state. It is permitted only for low-frequency structural providers (e.g. Radix UI primitive internals).
2. **Redux Toolkit (RTK):**
   - *Evaluation:* While Redux Toolkit solves selector subscriptions, it brings significant bundle weight (~30KB+ gzipped with dependencies), heavy conceptual overhead (actions, reducers, dispatchers, middleware), and cumbersome boilerplate for straightforward optimistic state updates.
3. **Zustand:**
   - *Evaluation:* Tiny footprint (<1.2KB gzipped). Built on the pub/sub selector model with React 18's `useSyncExternalStore`. Components only re-render if the exact selected state slice changes (`useTaskStore(state => state.activeTask)`). Provides `getState()` and `setState()` for imperative reads/writes outside React components. Zero boilerplate.

## Decision
We adopt **Zustand** as the standard, exclusive global state manager for the OS11 renderer.
React Context is banned for global domain state.

## Consequences
- **Positive:**
  - Microsecond-level state updates with granular selector subscriptions. A task checkbox click re-renders only that specific task row.
  - Full support for optimistic mutations and rollbacks.
  - Direct integration with IPC events: main process pushes can directly call `useTaskStore.getState().applyServerUpdate(...)` without passing through component tree props.
  - Tiny bundle size footprint (<1.2KB).
- **Negative / Considerations:**
  - Developers must use selector functions (`useStore(s => s.item)`) rather than destructuring the entire store (`const { item } = useStore()`) to prevent unnecessary component re-renders. This is codified in component development guidelines.
