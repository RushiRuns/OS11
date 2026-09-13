# OS11 — Database Migrations Guide

> **The data model is treated as sacred.**
> No AI tool or developer modifies schema files without a human reviewing the migration path.
> Every database change must receive a new sequential SQL migration file in this directory.

---

## 1. Migration Naming Convention

Migration files follow the strict format:
```
NNNN_short_description.sql
```
- `NNNN`: A 4-digit sequential integer zero-padded (e.g. `0001`, `0002`, `0003`).
- `short_description`: Lowercase snake_case description of what is modified (e.g. `0002_add_calendar_links.sql`).

## 2. Execution & Version Tracking

- **Tracking:** The database version is tracked using SQLite's native `PRAGMA user_version`.
- **Atomic Transactions:** Each migration file executes in an isolated transaction. If any statement fails, the entire transaction rolls back and the app refuses to start, preventing corrupted partial schemas.
- **Sequential Execution:** The migration runner (`src/main/migrations/runner.ts`) scans this directory at startup, checks `PRAGMA user_version`, and applies all pending migrations in ascending numeric order.

## 3. How to Add a New Migration

1. Identify the current highest version number in this folder (e.g. `0001`).
2. Create the next sequential file (e.g. `0002_add_field_to_tasks.sql`).
3. Write standard SQLite DDL statements.
4. If altering tables, ensure backward compatibility or write an explicit data-migration script.
5. Update `SCHEMA.md` to reflect the new table or column structure.
6. Test applying the migration against an existing database before committing.

## 4. Human Review Required

Human sign-off is mandatory if a migration:
- Drops a table, column, or trigger (`DROP TABLE`, `DROP COLUMN`).
- Modifies foreign key constraints on existing relationships.
- Rewrites or rebuilds the FTS5 full-text index.
- Alters default settings or module toggles.
