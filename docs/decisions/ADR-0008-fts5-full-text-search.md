# ADR-0008: SQLite FTS5 Virtual Table with Off-Thread Search Worker

## Status
Accepted

## Context
Instant, ubiquitous search is a core pillar of OS11 ("Insane Speed" and "Extreme Convenience"). Users expect real-time, as-you-type search results across:
- Task titles
- Rich text task notes (sanitized text content)
- Project names and section headers
- Comment threads
- Local attachment filenames and metadata

The search subsystem must deliver results in sub-10ms across 20,000+ items without causing a single frame drop in the UI thread.

### Evaluated Alternatives
1. **Client-side JS Full-Text Indexes (e.g. `FlexSearch`, `Lunr.js`, `MiniSearch`):**
   - *Cons:* Requires loading the entire search corpus into renderer memory on startup (consuming 40-100MB+ of heap). Serializing and deserializing the search index causes startup delays. Incurs high garbage collection overhead and duplicates data already stored in SQLite.
2. **SQLite `LIKE '%query%'` queries:**
   - *Cons:* Full table scans on every keystroke. Cannot leverage standard B-tree indexes for substring search. Lacks ranking, term frequency weighting, stemming, and tokenization. Degrades noticeably with large datasets.
3. **SQLite FTS5 Virtual Tables:**
   - *Pros:* Native C implementation built directly into SQLite. Supports Porter stemming, BM25 relevance ranking, prefix search (`word*`), tokenization, and negligible memory footprint on disk.

### Process Placement: Main Process vs Worker Thread
Running search queries directly in the Main process risks blocking incoming IPC messages from the renderer during intense queries or full re-indexing passes.
To guarantee complete isolation, search operations run inside a dedicated Node.js **Worker Thread** (`src/worker/search/`).

## Decision
1. We use SQLite's native **FTS5 virtual table** (`tasks_fts`) as the authoritative search engine.
2. The FTS5 index is updated synchronously via database triggers or repository write hooks.
3. Search execution and background re-indexing are isolated in a background **Worker Thread** (`src/worker/search/`), communicating with the Main process via `worker.postMessage` / `parentPort.postMessage`.

## Consequences
- **Positive:**
  - Sub-10ms query times with BM25 relevance ranking.
  - Zero memory bloat in the renderer process.
  - The UI remains completely responsive at 60fps/120fps even during complex search queries or index rebuilds.
  - Portable and zero-dependency: works out of the box with `better-sqlite3`.
- **Negative / Considerations:**
  - Rich text notes containing HTML tags must be stripped of HTML markup before insertion into the FTS5 index to prevent search tokens from indexing HTML attributes.
