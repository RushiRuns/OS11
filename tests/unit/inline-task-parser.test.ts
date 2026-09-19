import { describe, it, expect } from 'vitest';
import { parseInlineTaskInput, tokenizeInlineSyntax } from '../../src/shared/utils/inline-task-parser.js';

describe('Domain: Inline Task Parser', () => {
  describe('parseInlineTaskInput', () => {
    it('extracts simple title, notes, and tags', () => {
      const input = 'my first task :this is my first task in this app: #work';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('my first task');
      expect(result.notes).toBe('this is my first task in this app');
      expect(result.tags).toEqual(['work']);
    });

    it('extracts tags placed inside notes', () => {
      const input = 'my first task :this is my first task in this app #work:';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('my first task');
      expect(result.notes).toBe('this is my first task in this app');
      expect(result.tags).toEqual(['work']);
    });

    it('extracts tags placed before title and inside notes', () => {
      const input = '#urgent Important task :check #finance reports: #today';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Important task');
      expect(result.notes).toBe('check reports');
      expect(result.tags).toEqual(['finance', 'urgent', 'today']);
    });

    it('handles multiline notes inside colons', () => {
      const input = 'Weekly report :Line 1\nLine 2\nLine 3: #report';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Weekly report');
      expect(result.notes).toBe('Line 1\nLine 2\nLine 3');
      expect(result.tags).toEqual(['report']);
    });

    it('handles unclosed colon by treating everything after colon as notes', () => {
      const input = 'Task with open colon :this is still being typed';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Task with open colon');
      expect(result.notes).toBe('this is still being typed');
      expect(result.tags).toEqual([]);
    });

    it('handles unclosed colon with embedded tag', () => {
      const input = 'Task title :work in progress #dev';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Task title');
      expect(result.notes).toBe('work in progress');
      expect(result.tags).toEqual(['dev']);
    });

    it('handles task with only title', () => {
      const input = 'Simple task';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Simple task');
      expect(result.notes).toBeNull();
      expect(result.tags).toEqual([]);
    });

    it('handles task with title and multiple tags but no notes', () => {
      const input = 'Task with tags #one #two #three';
      const result = parseInlineTaskInput(input);

      expect(result.title).toBe('Task with tags');
      expect(result.notes).toBeNull();
      expect(result.tags).toEqual(['one', 'two', 'three']);
    });

    it('handles empty input gracefully', () => {
      const result = parseInlineTaskInput('   ');

      expect(result.title).toBe('');
      expect(result.notes).toBeNull();
      expect(result.tags).toEqual([]);
    });
  });

  describe('tokenizeInlineSyntax', () => {
    it('tokenizes title without colons', () => {
      const tokens = tokenizeInlineSyntax('Hello world #tag');
      expect(tokens).toEqual([
        { type: 'title', text: 'Hello world ' },
        { type: 'tag', text: '#tag' },
      ]);
    });

    it('tokenizes closed colons with notes and tags', () => {
      const tokens = tokenizeInlineSyntax('Task :note #dev: more title');
      expect(tokens).toEqual([
        { type: 'title', text: 'Task ' },
        { type: 'delimiter', text: ':' },
        { type: 'notes', text: 'note ' },
        { type: 'tag', text: '#dev' },
        { type: 'delimiter', text: ':' },
        { type: 'title', text: ' more title' },
      ]);
    });

    it('tokenizes unclosed colon', () => {
      const tokens = tokenizeInlineSyntax('Task :typing note');
      expect(tokens).toEqual([
        { type: 'title', text: 'Task ' },
        { type: 'delimiter', text: ':' },
        { type: 'notes', text: 'typing note' },
      ]);
    });
  });
});
