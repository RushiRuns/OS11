import { describe, it, expect } from 'vitest';
import { parseInlineTaskInput, tokenizeInlineSyntax } from '../../src/shared/utils/inline-task-parser.js';

describe('Feature: QuickAdd Inline Syntax (@Area and /Project)', () => {
  describe('parseInlineTaskInput', () => {
    it('parses bare @Area from task input', () => {
      const input = 'Buy milk @Personal #errands';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Buy milk');
      expect(parsed.areaName).toBe('Personal');
      expect(parsed.tags).toEqual(['errands']);
      expect(parsed.projectName).toBeNull();
    });

    it('parses quoted @"Area Name" with spaces', () => {
      const input = 'Fix sink @"Home & Living" :call plumber first: #urgent';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Fix sink');
      expect(parsed.areaName).toBe('Home & Living');
      expect(parsed.notes).toBe('call plumber first');
      expect(parsed.tags).toEqual(['urgent']);
    });

    it('parses bare /Project from task input', () => {
      const input = 'Update API endpoint /Backend #dev';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Update API endpoint');
      expect(parsed.projectName).toBe('Backend');
      expect(parsed.tags).toEqual(['dev']);
      expect(parsed.areaName).toBeNull();
    });

    it('parses quoted /"Project Name" with spaces', () => {
      const input = 'Write release notes /"Q4 Release" #docs';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Write release notes');
      expect(parsed.projectName).toBe('Q4 Release');
      expect(parsed.tags).toEqual(['docs']);
    });

    it('parses both @Area and /Project when both are specified', () => {
      const input = 'Draft architecture doc @Work /"Core Platform" #v2';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Draft architecture doc');
      expect(parsed.areaName).toBe('Work');
      expect(parsed.projectName).toBe('Core Platform');
      expect(parsed.tags).toEqual(['v2']);
    });

    it('preserves clean title without syntax remnants', () => {
      const input = '@Personal Prepare dinner /Family #today :grocery list:';
      const parsed = parseInlineTaskInput(input);

      expect(parsed.title).toBe('Prepare dinner');
      expect(parsed.areaName).toBe('Personal');
      expect(parsed.projectName).toBe('Family');
      expect(parsed.notes).toBe('grocery list');
      expect(parsed.tags).toEqual(['today']);
    });
  });

  describe('tokenizeInlineSyntax', () => {
    it('tokenizes @Area and /Project tokens for real-time visual feedback', () => {
      const input = 'Review PR @Work /Infra #code';
      const tokens = tokenizeInlineSyntax(input);

      const areaToken = tokens.find((t) => t.type === 'area');
      const projectToken = tokens.find((t) => t.type === 'project');
      const tagToken = tokens.find((t) => t.type === 'tag');

      expect(areaToken).toBeDefined();
      expect(areaToken?.text).toBe('@Work');

      expect(projectToken).toBeDefined();
      expect(projectToken?.text).toBe('/Infra');

      expect(tagToken).toBeDefined();
      expect(tagToken?.text).toBe('#code');
    });

    it('tokenizes quoted entities properly', () => {
      const input = 'Deploy @"Production Cloud" /"Web App"';
      const tokens = tokenizeInlineSyntax(input);

      const areaToken = tokens.find((t) => t.type === 'area');
      const projectToken = tokens.find((t) => t.type === 'project');

      expect(areaToken).toBeDefined();
      expect(areaToken?.text).toBe('@"Production Cloud"');

      expect(projectToken).toBeDefined();
      expect(projectToken?.text).toBe('/"Web App"');
    });
  });
});
