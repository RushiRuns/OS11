import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';

describe('Domain: Quick Add NLP Parsing IPC Contract', () => {
  it('parses quick add input with multiple tags and priority', () => {
    const res = parseQuickAdd('Ship feature release by tomorrow at 5pm #release #v1 !high');
    expect(res.cleanTitle).toBe('Ship feature release');
    expect(res.tagNames).toEqual(['release', 'v1']);
    expect(res.priority).toBe(3);
    expect(res.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.dueTime).toBe('17:00:00');
    expect(res.allDay).toBe(false);
  });

  it('parses @list reference and pomodoro indicator', () => {
    const res = parseQuickAdd('Draft product documentation @Work 🍅');
    expect(res.cleanTitle).toBe('Draft product documentation');
    expect(res.listName).toBe('Work');
    expect(res.pomodoroRequested).toBe(true);
  });

  it('parses recurrence rules for periodic tasks', () => {
    const resWeekday = parseQuickAdd('Standup call every weekday');
    expect(resWeekday.cleanTitle).toBe('Standup call');
    expect(resWeekday.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');

    const resMonthly = parseQuickAdd('Pay rent monthly');
    expect(resMonthly.cleanTitle).toBe('Pay rent');
    expect(resMonthly.recurrenceRule).toBe('RRULE:FREQ=MONTHLY');
  });

  it('handles plain task with no tokens without modification', () => {
    const res = parseQuickAdd('Plain simple task without special tokens');
    expect(res.cleanTitle).toBe('Plain simple task without special tokens');
    expect(res.priority).toBe(0);
    expect(res.tagNames).toEqual([]);
    expect(res.listName).toBeNull();
    expect(res.pomodoroRequested).toBe(false);
    expect(res.recurrenceRule).toBeNull();
  });
});
