import { BaseRepository } from './base-repository.js';
import type { SearchResult } from '../../shared/types/search.js';

export type { SearchResult };

export class SearchRepository extends BaseRepository {
  public search(query: string): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    // Tokenize terms and escape them safely for FTS5 prefix search
    const terms = trimmed
      .split(/\s+/)
      .map((term) => term.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, ''))
      .filter((term) => term.length > 0);

    if (terms.length === 0) {
      return [];
    }

    const ftsQuery = terms.map((term) => `"${term}"*`).join(' ');

    try {
      const stmt = this.db.prepare<[string], SearchResult>(`
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
      // Fallback: If FTS syntax somehow fails, perform parameterized LIKE search
      const fallbackStmt = this.db.prepare<[string, string], SearchResult>(`
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
      const likeQuery = `%${trimmed}%`;
      return fallbackStmt.all(likeQuery, likeQuery);
    }
  }
}
