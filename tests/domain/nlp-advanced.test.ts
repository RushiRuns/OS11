import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';

describe('Domain: Advanced NLP Quick-Add Parsing', () => {
  it('should extract tags and lists correctly', () => {
    const parsed = parseQuickAdd('Prepare sprint review #work #planning @Projects');
    expect(parsed.cleanTitle).toBe('Prepare sprint review');
    expect(parsed.tagNames).toEqual(['work', 'planning']);
    expect(parsed.listName).toBe('Projects');
  });

  it('should extract priority modifiers correctly', () => {
    expect(parseQuickAdd('Fix critical bug !critical').priority).toBe(4);
    expect(parseQuickAdd('High priority item !high').priority).toBe(3);
    expect(parseQuickAdd('Medium item !med').priority).toBe(2);
    expect(parseQuickAdd('Low item !low').priority).toBe(1);
    expect(parseQuickAdd('Numeric high !3').priority).toBe(3);
    expect(parseQuickAdd('Single exclamation !').priority).toBe(1);
    expect(parseQuickAdd('Double exclamation !!').priority).toBe(2);
    expect(parseQuickAdd('Triple exclamation !!!').priority).toBe(3);
  });

  it('should detect pomodoro request with tomato emoji', () => {
    const parsed = parseQuickAdd('Focus deep session 🍅');
    expect(parsed.pomodoroRequested).toBe(true);
    expect(parsed.cleanTitle).toBe('Focus deep session');
  });

  it('should detect recurrence patterns', () => {
    const parsedDaily = parseQuickAdd('Morning standup every day');
    expect(parsedDaily.recurrenceRule).toBe('RRULE:FREQ=DAILY');
    expect(parsedDaily.cleanTitle).toBe('Morning standup');

    const parsedWeekly = parseQuickAdd('Weekly sync every monday');
    expect(parsedWeekly.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
  });

  it('should combine all modifiers cleanly', () => {
    const input = 'Submit tax returns tomorrow at 4pm #finance @Important !urgent 🍅';
    const parsed = parseQuickAdd(input);
    expect(parsed.cleanTitle).toBe('Submit tax returns');
    expect(parsed.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.dueTime).toBe('16:00:00');
    expect(parsed.allDay).toBe(false);
    expect(parsed.priority).toBe(3);
    expect(parsed.tagNames).toEqual(['finance']);
    expect(parsed.listName).toBe('Important');
    expect(parsed.pomodoroRequested).toBe(true);
  });
});
