import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';

describe('Domain: NLP Quick-Add with GTD Buckets', () => {
  it('parses ~anytime token and removes it from clean title', () => {
    const res = parseQuickAdd('Call plumber ~anytime !high #home');
    expect(res.bucket).toBe('anytime');
    expect(res.cleanTitle).toBe('Call plumber');
    expect(res.priority).toBe(3);
    expect(res.tagNames).toContain('home');
  });

  it('parses ~any alias', () => {
    const res = parseQuickAdd('Check oil level ~any');
    expect(res.bucket).toBe('anytime');
    expect(res.cleanTitle).toBe('Check oil level');
  });

  it('parses ~someday token and removes it from clean title', () => {
    const res = parseQuickAdd('Learn Norwegian ~someday');
    expect(res.bucket).toBe('someday');
    expect(res.cleanTitle).toBe('Learn Norwegian');
  });

  it('parses ~some alias', () => {
    const res = parseQuickAdd('Build a cedar sauna ~some');
    expect(res.bucket).toBe('someday');
    expect(res.cleanTitle).toBe('Build a cedar sauna');
  });

  it('enforces R2: bucket token clears any parsed due dates and recurrence rules', () => {
    const res = parseQuickAdd('Review mortgage options ~someday tomorrow at 5pm daily');
    expect(res.bucket).toBe('someday');
    expect(res.dueDate).toBeNull();
    expect(res.dueTime).toBeNull();
    expect(res.recurrenceRule).toBeNull();
    expect(res.cleanTitle).toBe('Review mortgage options');
  });

  it('leaves bucket null when no bucket token is present', () => {
    const res = parseQuickAdd('Clean the garage tomorrow');
    expect(res.bucket).toBeNull();
    expect(res.dueDate).toBeDefined();
  });
});
