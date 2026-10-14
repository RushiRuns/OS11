import React, { useMemo } from 'react';
import styles from './HighlightMark.module.css';

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds all character index ranges [start, end] in `text` that match any token.
 * Tokens are matched case-insensitively with Unicode support.
 * Overlapping and adjacent ranges are merged.
 */
export function findMarkRanges(text: string, tokens: string[]): Array<[number, number]> {
  if (!text || tokens.length === 0) {
    return [];
  }

  const validTokens = tokens.filter((t) => t.length > 0);
  if (validTokens.length === 0) {
    return [];
  }

  // Ensure tokens are sorted longest-first so alternation matches greedy prefix
  const sortedTokens = [...validTokens].sort((a, b) => b.length - a.length);
  const pattern = sortedTokens.map(escapeRegExp).join('|');
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'giu');
  } catch {
    return [];
  }

  const rawRanges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (end > start) {
      rawRanges.push([start, end]);
    }
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  if (rawRanges.length === 0) {
    return [];
  }

  // Sort ranges by start position, then by end descending
  rawRanges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  // Merge overlapping and adjacent ranges
  const merged: Array<[number, number]> = [rawRanges[0]];
  for (let i = 1; i < rawRanges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = rawRanges[i];

    if (curr[0] <= prev[1]) {
      if (curr[1] > prev[1]) {
        prev[1] = curr[1];
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export interface HighlightMarkProps {
  text: string;
  tokens: string[];
  className?: string;
}

/**
 * HighlightMark renders a text string with matching search tokens wrapped in `<mark>`.
 * Uses React nodes only (no dangerouslySetInnerHTML) and has zero animations.
 */
export const HighlightMark: React.FC<HighlightMarkProps> = React.memo(function HighlightMark({
  text,
  tokens,
  className,
}) {
  const tokenKey = useMemo(() => tokens.join('\0'), [tokens]);

  const ranges = useMemo(() => {
    return findMarkRanges(text, tokens);
  }, [text, tokenKey]);

  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    nodes.push(
      <mark key={`mark-${start}-${end}`} className={styles.mark}>
        {text.slice(start, end)}
      </mark>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
});

export default HighlightMark;
