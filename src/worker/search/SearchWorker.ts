import Database from 'better-sqlite3';

export interface SearchWorkerResult {
  id: string;
  title: string;
  snippet: string;
  listId: string;
}

export class SearchWorker {
  private db: Database.Database | null = null;

  constructor(dbPath?: string) {
    if (dbPath) {
      this.initDb(dbPath);
    }
  }

  public initDb(dbPath: string): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore close error
      }
    }
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('cache_size = -16000');
  }

  public search(query: string): SearchWorkerResult[] {
    if (!this.db) {
      throw new Error('SearchWorker database not initialized.');
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const terms = trimmed
      .split(/\s+/)
      .map((term) => term.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, ''))
      .filter((term) => term.length > 0);

    if (terms.length === 0) {
      return [];
    }

    const ftsQuery = terms.map((term) => `"${term}"*`).join(' ');

    try {
      const stmt = this.db.prepare<[string], SearchWorkerResult>(`
        SELECT
          t.id,
          t.title,
          COALESCE(snippet(tasks_fts, -1, '<mark>', '</mark>', '...', 16), t.title) AS snippet,
          t.list_id AS listId
        FROM tasks_fts
        JOIN tasks t ON t.id = tasks_fts.id
        WHERE tasks_fts MATCH ? AND t.is_trashed = 0
        ORDER BY rank
        LIMIT 50
      `);
      return stmt.all(ftsQuery);
    } catch {
      const fallbackStmt = this.db.prepare<[string, string], SearchWorkerResult>(`
        SELECT
          id,
          title,
          title AS snippet,
          list_id AS listId
        FROM tasks
        WHERE is_trashed = 0 AND (title LIKE ? OR notes LIKE ?)
        ORDER BY updated_at DESC
        LIMIT 50
      `);
      const like = `%${trimmed}%`;
      return fallbackStmt.all(like, like);
    }
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore
      }
      this.db = null;
    }
  }
}

export default SearchWorker;
