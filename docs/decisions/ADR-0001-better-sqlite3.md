# ADR-0001: Use better-sqlite3 over sql.js, node-sqlite3, and Prisma

## Status
Accepted

## Context
OS11 is an uncompromisingly fast, local-first personal operating system. The persistence layer sits entirely in the Electron Main process and executes all database reads and writes on behalf of the application. 

The storage engine must fulfill five hard constraints:
1. **Synchronous Execution:** Database operations in the main process must execute synchronously without async event-loop tick delays, Promise microtask queues, or async serialization overhead, enabling sub-16ms transactional commits within a single frame.
2. **Zero Server / Zero Cloud:** The database runs directly on disk as a single portable file (`app.getPath('userData')/os11.db`).
3. **Advanced SQLite Features:** Built-in WAL (Write-Ahead Logging), FTS5 virtual tables with custom tokenizers, generated columns, foreign key enforcement, and user version pragmas.
4. **Minimal Binary & Memory Overhead:** Keep idle memory consumption low and minimize application footprint.
5. **Rock-Solid Stability:** Zero data corruption risk during sudden process termination or unexpected machine shutdowns.

### Evaluated Alternatives
1. **`sql.js` (WebAssembly SQLite):**
   - *Pros:* Runs in pure WebAssembly with zero native compilation requirements.
   - *Cons:* In-memory database model requiring full binary serialization (`export()`) to write back to disk on mutations. Stalls the event loop on multi-megabyte datasets. Unacceptable performance on datasets with 10,000+ tasks or large FTS indexes. Lacks proper multi-threaded concurrency support.
2. **`node-sqlite3`:**
   - *Pros:* Widely used historical binding for Node.js.
   - *Cons:* Asynchronous callback-based API forcing Promise wrapping for every single operation. Slower throughput due to excessive thread-pool context switching for trivial single-row reads. Maintenance has been stagnant and compilation issues on newer Electron versions are frequent.
3. **`Prisma` (ORM):**
   - *Pros:* High-level declarative schema and auto-generated TypeScript clients.
   - *Cons:* Massive bundle overhead (ships a 30MB-40MB Rust query engine binary). Imposes an async IPC-like query layer even within Node.js, introducing significant query latency. Violates OS11 bundle budget and memory constraints.

## Decision
We select `better-sqlite3` as the sole persistence engine for OS11.

## Consequences
- **Positive:**
  - Fast prepared statements: statement preparation happens once at startup, followed by direct C++ binding execution.
  - Zero async overhead: allows atomic transactions without Promise overhead in `src/main/repositories/`.
  - Full native SQLite feature set: WAL mode, synchronous=NORMAL, custom FTS5 virtual tables, and `PRAGMA user_version` migrations.
  - Transparent error boundaries: SQLite syntax or constraint violations throw immediate synchronous exceptions caught cleanly by repository methods and IPC handlers.
- **Negative / Considerations:**
  - Native C++ binding requires rebuild against Electron's Node ABI (`electron-rebuild` / `npm rebuild`). Handled automatically via `electron-builder` postinstall / build scripts.
  - Must live exclusively in `src/main/` and `src/worker/`. The renderer process is strictly prohibited from importing `better-sqlite3` (enforced via ESLint).
