export interface ParsedInlineTask {
  title: string;
  notes: string | null;
  tags: string[];
}

export type InlineTokenType = 'title' | 'notes' | 'tag' | 'delimiter';

export interface InlineSyntaxToken {
  type: InlineTokenType;
  text: string;
}

/**
 * Extracts and removes `#tag` tokens from a string.
 * Returns the cleaned string and the list of extracted tag names.
 */
function extractAndStripTags(input: string): { cleaned: string; tags: string[] } {
  const tags: string[] = [];
  const tagFullRegex = /(^|\s)#([a-zA-Z0-9_\-\u00C0-\u017F]+)(?=\s|$)/g;

  let cleaned = input.replace(tagFullRegex, (_match, prefix, tagName) => {
    if (!tags.includes(tagName)) {
      tags.push(tagName);
    }
    return prefix ? ' ' : '';
  });

  // Normalize horizontal spaces without destroying newlines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.replace(/[^\S\r\n]+/g, ' ').trim())
    .join('\n')
    .trim();

  return { cleaned, tags };
}

/**
 * Parses an inline task input string containing optional colon-delimited notes (`:<notes>:`)
 * and `#tags` located anywhere in the input.
 */
export function parseInlineTaskInput(rawText: string): ParsedInlineTask {
  const text = rawText.trim();
  if (!text) {
    return { title: '', notes: null, tags: [] };
  }

  const allTags: string[] = [];
  let notesRaw: string | null = null;
  let titleRaw = text;

  // Check for colon delimiters: either closed `:...:` or unclosed `:...` at the end
  const closedColonMatch = text.match(/^(.*?):([\s\S]*?):(.*?)$/);
  if (closedColonMatch) {
    const beforeColon = closedColonMatch[1];
    notesRaw = closedColonMatch[2];
    const afterColon = closedColonMatch[3];
    titleRaw = `${beforeColon} ${afterColon}`.trim();
  } else {
    // Check for unclosed colon
    const unclosedColonMatch = text.match(/^(.*?):([\s\S]+)$/);
    if (unclosedColonMatch) {
      titleRaw = unclosedColonMatch[1].trim();
      notesRaw = unclosedColonMatch[2];
    }
  }

  // Extract tags from notes if notes exist
  let finalNotes: string | null = null;
  if (notesRaw !== null) {
    const { cleaned, tags } = extractAndStripTags(notesRaw);
    for (const tag of tags) {
      if (!allTags.includes(tag)) {
        allTags.push(tag);
      }
    }
    finalNotes = cleaned.length > 0 ? cleaned : null;
  }

  // Extract tags from title
  const { cleaned: finalTitleClean, tags: titleTags } = extractAndStripTags(titleRaw);
  for (const tag of titleTags) {
    if (!allTags.includes(tag)) {
      allTags.push(tag);
    }
  }

  let finalTitle = finalTitleClean.replace(/\s+/g, ' ').trim();

  // If title is empty but notes exist, fallback to using notes as title
  if (!finalTitle && finalNotes) {
    const lines = finalNotes.split('\n');
    finalTitle = lines[0].trim();
    if (lines.length > 1) {
      finalNotes = lines.slice(1).join('\n').trim() || null;
    } else {
      finalNotes = null;
    }
  }

  return {
    title: finalTitle,
    notes: finalNotes,
    tags: allTags,
  };
}

/**
 * Tokenizes the input string for real-time visual syntax highlighting while typing.
 */
export function tokenizeInlineSyntax(input: string): InlineSyntaxToken[] {
  if (!input) return [];

  const tokens: InlineSyntaxToken[] = [];
  let currentIndex = 0;

  // Check if colon exists
  const firstColon = input.indexOf(':');

  if (firstColon === -1) {
    // No colon, tokenize title and tags
    tokenizeTitleAndTags(input, tokens);
    return tokens;
  }

  // Text before colon
  const beforeColon = input.slice(0, firstColon);
  if (beforeColon) {
    tokenizeTitleAndTags(beforeColon, tokens);
  }

  // Colon open
  tokens.push({ type: 'delimiter', text: ':' });
  currentIndex = firstColon + 1;

  // Search for closing colon
  const secondColon = input.indexOf(':', currentIndex);

  if (secondColon !== -1) {
    // Enclosed notes
    const notesContent = input.slice(currentIndex, secondColon);
    tokenizeNotesAndTags(notesContent, tokens);

    // Colon close
    tokens.push({ type: 'delimiter', text: ':' });
    currentIndex = secondColon + 1;

    // Remaining text after second colon
    const afterColon = input.slice(currentIndex);
    if (afterColon) {
      tokenizeTitleAndTags(afterColon, tokens);
    }
  } else {
    // Unclosed colon to end of string
    const notesContent = input.slice(currentIndex);
    tokenizeNotesAndTags(notesContent, tokens);
  }

  return tokens;
}

function tokenizeTitleAndTags(text: string, tokens: InlineSyntaxToken[]): void {
  const parts = text.split(/(#[a-zA-Z0-9_\-\u00C0-\u017F]+)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('#')) {
      tokens.push({ type: 'tag', text: part });
    } else {
      tokens.push({ type: 'title', text: part });
    }
  }
}

function tokenizeNotesAndTags(text: string, tokens: InlineSyntaxToken[]): void {
  const parts = text.split(/(#[a-zA-Z0-9_\-\u00C0-\u017F]+)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('#')) {
      tokens.push({ type: 'tag', text: part });
    } else {
      tokens.push({ type: 'notes', text: part });
    }
  }
}
