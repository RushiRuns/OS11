# ADR-0007: Use Fractional Indexing with sort_order REAL for Drag-and-Drop Reordering

## Status
Accepted

## Context
OS11 features fluid, keyboard-driven and mouse drag-and-drop reordering for tasks, lists, sections, and projects. 

When a user drags an item between two other items or moves an item to the top or bottom of a list, the persistence layer must update the item's position reliably and instantaneously.

### Evaluated Alternatives
1. **Integer Sequencing (`sort_order INTEGER: 0, 1, 2, ...`):**
   - *Problem:* Inserting an item between position 4 and 5 requires re-indexing all subsequent items (`UPDATE tasks SET sort_order = sort_order + 1 WHERE sort_order >= 5`).
   - On a list with 1,000 tasks, moving one task from the bottom to the top triggers an **O(N) database write transaction** rewriting 999 database rows, invalidating database caches, and flooding the disk WAL. In Phase 2 sync, this would generate 999 individual mutation events across peer devices.
   - Completely unacceptable for sub-16ms interactive dragging.
2. **Linked Lists (`prev_id` / `next_id` pointers):**
   - *Problem:* Complex transactional updates (updating 3-4 rows simultaneously). Ordering a list in SQL queries requires recursive Common Table Expressions (`WITH RECURSIVE`), which are notoriously slow to execute on large datasets and difficult to paginate efficiently.
3. **Fractional Indexing (`sort_order REAL`):**
   - *Approach:* Each item possesses a floating-point `sort_order REAL`. When an item is moved between two items with orders $A$ and $B$, its new sort order is simply calculated as:
     $$\text{sort\_order} = \frac{A + B}{2}$$
   - When moved to the beginning: $A - 1.0$.
   - When moved to the end: $B + 1.0$.

## Decision
We adopt **Fractional Indexing** using `sort_order REAL` across all orderable entities in OS11 (`tasks`, `lists`, `list_groups`, `projects`, `sections`).

### Precision & Rebalancing
- JavaScript's 64-bit IEEE 754 floating-point numbers support 53 bits of precision, allowing dozens of consecutive insertions between adjacent items before precision degradation.
- A periodic maintenance rebalancing routine runs in the background when the difference between adjacent items $|A - B| < 10^{-9}$, re-spacing items by increments of `1000.0` to restore numeric headroom.

## Consequences
- **Positive:**
  - **O(1) Single-Row Mutation:** Drag-and-drop reordering updates exactly **one** database row, taking <1ms in SQLite.
  - Trivial SQL queries: ordering is a standard index-backed `ORDER BY sort_order ASC`.
  - Zero lock contention or WAL bloat during user drag interactions.
  - Phase 2 synchronization friendliness: peer sync records a single change event for a reorder.
- **Negative / Considerations:**
  - Requires maintaining the fractional calculation helper in `src/shared/utils/` and rebalance logic in repository maintenance tasks.
