# OS11 — Definition of Done (DoD)

> **Consult this checklist before closing any feature, submitting a PR, or marking a task complete.**
> Every checkbox must be satisfied. If a requirement is not applicable, state why in the commit or session log.

---

## Feature Completion Checklist

- [ ] **1. Happy path tested**
  - Primary user flow functions without glitches, freezes, or console errors.
  - Interactivity responds within the target frame budget (<16ms).

- [ ] **2. Empty state exists and is correct**
  - When no data exists (e.g. no tasks, empty list, no search results), an intentional empty state is shown using `EmptyState`.
  - Empty state copy uses calm, supportive typography (`--text-secondary` / `--text-tertiary`) and offers a direct action where appropriate.

- [ ] **3. Error state exists and is handled**
  - Failures (e.g. disk write failure, invalid input, parse error) display actionable feedback (e.g. `Toast` error variant or inline field error).
  - Unhandled promise rejections and silent failures are strictly forbidden.

- [ ] **4. No hardcoded color, size, radius, or font value (Tokens only)**
  - All styling utilizes CSS variables defined in `src/renderer/styles/tokens.css`.
  - Zero raw hex codes (`#fff`), zero raw pixel margins/paddings (`padding: 12px`), zero ad-hoc font definitions.
  - Verified in both Light Mode and Dark Mode (`[data-theme="dark"]`).

- [ ] **5. No renderer-side business logic**
  - The renderer is a view layer only.
  - All validation, calculation, natural language parsing, and data manipulation reside in `src/main/domain/` as pure functions.
  - The renderer never imports from `src/main/repositories/` or `better-sqlite3`.

- [ ] **6. All IPC handlers use `try/catch` and return `{ ok, data/error }`**
  - Every `ipcMain.handle` callback is wrapped in `try { ... return { ok: true, data }; } catch (err) { return { ok: false, error: err.message }; }`.
  - Consistent envelope across all channels; no uncaught exceptions crossing the IPC bridge.

- [ ] **7. Virtual scrolling applied to any unbounded list**
  - Any list capable of growing beyond visible screen real estate (e.g. tasks list, logs, search results) implements `@tanstack/react-virtual`.
  - DOM element counts remain stable regardless of data set size.

- [ ] **8. Optimistic update pattern used for all write operations**
  - UI updates immediately on user action (e.g. task completion, reorder, delete).
  - Background IPC request confirms persistence; rolls back or shows notification on unexpected failure.

- [ ] **9. Reduced motion handled for animations**
  - Framer Motion and CSS transitions respect `prefers-reduced-motion`.
  - Instant transitions rendered when reduced motion is requested by the OS.
  - Framer Motion is restricted strictly to the 4 permitted sites (ADR-0009).

- [ ] **10. At least one automated test written**
  - Pure domain logic, repository queries, or React components have corresponding unit/integration tests in `tests/`.
  - All tests execute and pass via `npm test`.

- [ ] **11. `UTILITIES.md` updated**
  - Any newly created shared hook, shared component, domain function, or repository method is cataloged in `UTILITIES.md`.

- [ ] **12. `CHANGELOG_INTERNAL.md` updated**
  - Entry added following `[date] — [what was built] — [what changed architecturally]`.

- [ ] **13. `ARCHITECTURE.md` rules verified & committed to git**
  - Layer Order and process boundaries verified.
  - Changes staged, clean linter run (`npm run lint`), and committed with conventional commit message.
