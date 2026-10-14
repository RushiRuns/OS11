import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { findMarkRanges, HighlightMark } from '../../src/renderer/features/search/HighlightMark.js';

describe('HighlightMark: findMarkRanges', () => {
  it('returns empty ranges when text or tokens are empty', () => {
    expect(findMarkRanges('', ['test'])).toEqual([]);
    expect(findMarkRanges('test', [])).toEqual([]);
    expect(findMarkRanges('test', [''])).toEqual([]);
  });

  it('safely handles regex special characters without throwing', () => {
    const specialTokens = ['(', '[', '\\', '+', '*', '?', '^', '$', '.'];
    for (const char of specialTokens) {
      expect(() => findMarkRanges(`Formula ${char} item`, [char])).not.toThrow();
      const ranges = findMarkRanges(`Formula ${char} item`, [char]);
      expect(ranges.length).toBeGreaterThan(0);
    }
  });

  it('merges overlapping and adjacent tokens into a single range', () => {
    // Overlapping tokens "ab" and "abc" in "abcdef"
    const overlapping = findMarkRanges('abcdef', ['abc', 'ab']);
    expect(overlapping).toEqual([[0, 3]]);

    // Adjacent tokens "foo" and "bar" in "foobar"
    const adjacent = findMarkRanges('foobar', ['foo', 'bar']);
    expect(adjacent).toEqual([[0, 6]]);
  });

  it('correctly handles Unicode, emoji, and Devanagari text without splitting characters', () => {
    const devanagari = 'नमस्ते दुनिया';
    const ranges = findMarkRanges(devanagari, ['दुनिया']);
    expect(ranges).toEqual([[7, 13]]);
    expect(devanagari.slice(ranges[0][0], ranges[0][1])).toBe('दुनिया');

    const emojiText = 'Task 🚀 launch';
    const emojiRanges = findMarkRanges(emojiText, ['launch']);
    expect(emojiText.slice(emojiRanges[0][0], emojiRanges[0][1])).toBe('launch');
  });
});

describe('HighlightMark: Component Rendering', () => {
  it('renders plain text when no tokens match', () => {
    const html = renderToStaticMarkup(
      <HighlightMark text="Hello world" tokens={['xyz']} />
    );
    expect(html).toBe('<span>Hello world</span>');
    expect(html).not.toContain('<mark');
  });

  it('wraps matched tokens in <mark> tags', () => {
    const html = renderToStaticMarkup(
      <HighlightMark text="Buy fresh milk from store" tokens={['milk', 'buy']} />
    );
    expect(html).toContain('<mark');
    expect(html).toContain('>Buy</mark>');
    expect(html).toContain('>milk</mark>');
    expect(html).toContain('fresh');
    expect(html).toContain('from store');
  });

  it('renders merged mark for overlapping tokens', () => {
    const html = renderToStaticMarkup(
      <HighlightMark text="Searching" tokens={['search', 'searching']} />
    );
    expect(html).toContain('<mark');
    expect(html).toContain('>Searching</mark>');
    // Should only have 1 <mark> tag
    const markCount = (html.match(/<mark/g) || []).length;
    expect(markCount).toBe(1);
  });
});
