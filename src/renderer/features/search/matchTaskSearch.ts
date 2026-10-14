/**
 * OS11 View Search — Pure Task Matching Engine
 * Pure functions only. No external imports.
 */

const EMPTY_FROZEN_SET: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * Tokenize a search query string:
 * - trim, toLowerCase
 * - split on whitespace
 * - drop empty tokens
 * - remove duplicates
 * - sort longest first (for regex/matching priority), then alphabetically for stability
 */
export function tokenize(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const unique = Array.from(new Set(parts));
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return unique;
}

/**
 * Checks if a title matches all tokens (case-insensitive substring, any order).
 */
export function titleMatches(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return false;
  }
  const lower = title.toLowerCase();
  for (let i = 0; i < tokens.length; i++) {
    if (!lower.includes(tokens[i])) {
      return false;
    }
  }
  return true;
}

export interface TaskMatchResult {
  /** True if this task's own title matches OR any descendant matches */
  isMatch: boolean;
  /** True if this task's own title matches */
  isTitleMatch: boolean;
  /** Descendants whose own title matches, at any depth */
  matchingIds: Set<string>;
  /** matchingIds plus the intermediate ancestors between them and this task */
  visibleIds: Set<string>;
}

/**
 * Evaluates a task and its descendant tree against search tokens.
 * - Walk entire subtree with cycle protection.
 * - Resolves matching descendant IDs and all visible path ancestors.
 */
export function matchTaskTree(
  task: { id: string; title: string },
  getChildren: (id: string) => Array<{ id: string; title: string }>,
  tokens: string[],
): TaskMatchResult {
  if (tokens.length === 0) {
    return {
      isMatch: false,
      isTitleMatch: false,
      matchingIds: EMPTY_FROZEN_SET as Set<string>,
      visibleIds: EMPTY_FROZEN_SET as Set<string>,
    };
  }

  const isTitleMatch = titleMatches(task.title, tokens);
  const visited = new Set<string>([task.id]);
  const matchingIds = new Set<string>();
  const visibleIds = new Set<string>();

  function walk(currentId: string, pathFromRoot: string[]) {
    const children = getChildren(currentId);
    if (!children || children.length === 0) return;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (visited.has(child.id)) {
        continue;
      }
      visited.add(child.id);

      const childTitleMatches = titleMatches(child.title, tokens);
      if (childTitleMatches) {
        matchingIds.add(child.id);
        visibleIds.add(child.id);
        for (let p = 0; p < pathFromRoot.length; p++) {
          visibleIds.add(pathFromRoot[p]);
        }
      }

      walk(child.id, [...pathFromRoot, child.id]);
    }
  }

  walk(task.id, []);

  const isMatch = isTitleMatch || matchingIds.size > 0;

  return {
    isMatch,
    isTitleMatch,
    matchingIds: matchingIds.size === 0 ? (EMPTY_FROZEN_SET as Set<string>) : matchingIds,
    visibleIds: visibleIds.size === 0 ? (EMPTY_FROZEN_SET as Set<string>) : visibleIds,
  };
}
