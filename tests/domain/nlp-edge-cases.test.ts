import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';

describe('Domain: NLP Quick-Add Edge Cases & Syntax Variants (100% Coverage Target)', () => {
  describe('Empty and Edge Inputs', () => {
    it('handles empty and whitespace string inputs gracefully', () => {
      const empty = parseQuickAdd('');
      expect(empty.title).toBe('');
      expect(empty.cleanTitle).toBe('');
      expect(empty.dueDate).toBeNull();
      expect(empty.dueTime).toBeNull();
      expect(empty.allDay).toBe(true);
      expect(empty.priority).toBe(0);
      expect(empty.tagNames).toEqual([]);
      expect(empty.listName).toBeNull();
      expect(empty.pomodoroRequested).toBe(false);
      expect(empty.recurrenceRule).toBeNull();

      const whitespace = parseQuickAdd('   \t\n  ');
      expect(whitespace.cleanTitle).toBe('');
      expect(whitespace.priority).toBe(0);
    });
  });

  describe('Priority Syntax Variants', () => {
    it('parses all Critical variants (!4, !critical, !crit)', () => {
      expect(parseQuickAdd('Task !4').priority).toBe(4);
      expect(parseQuickAdd('Task !critical').priority).toBe(4);
      expect(parseQuickAdd('Task !crit').priority).toBe(4);
    });

    it('parses all High variants (!3, !high, !urgent, !!!)', () => {
      expect(parseQuickAdd('Task !3').priority).toBe(3);
      expect(parseQuickAdd('Task !high').priority).toBe(3);
      expect(parseQuickAdd('Task !urgent').priority).toBe(3);
      expect(parseQuickAdd('Task !!!').priority).toBe(3);
    });

    it('parses all Medium variants (!2, !med, !medium, !!)', () => {
      expect(parseQuickAdd('Task !2').priority).toBe(2);
      expect(parseQuickAdd('Task !med').priority).toBe(2);
      expect(parseQuickAdd('Task !medium').priority).toBe(2);
      expect(parseQuickAdd('Task !!').priority).toBe(2);
    });

    it('parses all Low variants (!1, !low, !)', () => {
      expect(parseQuickAdd('Task !1').priority).toBe(1);
      expect(parseQuickAdd('Task !low').priority).toBe(1);
      expect(parseQuickAdd('Task !').priority).toBe(1);
    });

    it('parses None / zero variants (!0, !none)', () => {
      expect(parseQuickAdd('Task !0').priority).toBe(0);
      expect(parseQuickAdd('Task !none').priority).toBe(0);
    });
  });

  describe('Recurrence Pattern Variants', () => {
    it('parses weekday and weekend recurrence rules', () => {
      expect(parseQuickAdd('Daily standup every weekday').recurrenceRule).toBe(
        'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
      );
      expect(parseQuickAdd('Review sprint every monday').recurrenceRule).toBe(
        'RRULE:FREQ=WEEKLY;BYDAY=MO'
      );
      expect(parseQuickAdd('Team retro every friday').recurrenceRule).toBe(
        'RRULE:FREQ=WEEKLY;BYDAY=FR'
      );
    });

    it('parses day, week, month, and year recurrence rules', () => {
      expect(parseQuickAdd('Journal daily').recurrenceRule).toBe('RRULE:FREQ=DAILY');
      expect(parseQuickAdd('Water plants every week').recurrenceRule).toBe('RRULE:FREQ=WEEKLY');
      expect(parseQuickAdd('Pay rent monthly').recurrenceRule).toBe('RRULE:FREQ=MONTHLY');
      expect(parseQuickAdd('Renew domain annually').recurrenceRule).toBe('RRULE:FREQ=YEARLY');
      expect(parseQuickAdd('File taxes every year').recurrenceRule).toBe('RRULE:FREQ=YEARLY');
    });
  });

  describe('Pomodoro Token Variants', () => {
    it('recognizes tomato emoji and textual :tomato: code', () => {
      const emoji = parseQuickAdd('Deep work session 🍅');
      expect(emoji.pomodoroRequested).toBe(true);
      expect(emoji.cleanTitle).toBe('Deep work session');

      const textCode = parseQuickAdd('Algorithm practice :tomato:');
      expect(textCode.pomodoroRequested).toBe(true);
      expect(textCode.cleanTitle).toBe('Algorithm practice');
    });
  });

  describe('Lists and Tags with Special Characters', () => {
    it('parses lists with dashes and underscores', () => {
      const parsed = parseQuickAdd('Task @work-project_2026');
      expect(parsed.listName).toBe('work-project_2026');
      expect(parsed.cleanTitle).toBe('Task');
    });

    it('extracts multiple tags with symbols and keeps clean title', () => {
      const parsed = parseQuickAdd('Implement auth #security_v1 #frontend-core');
      expect(parsed.tagNames).toEqual(['security_v1', 'frontend-core']);
      expect(parsed.cleanTitle).toBe('Implement auth');
    });
  });

  describe('Ambiguous and Complex Syntax Parsing', () => {
    it('cleans trailing prepositions like "by", "due", "on", "until"', () => {
      const parsed = parseQuickAdd('Submit proposal by tomorrow');
      expect(parsed.cleanTitle).toBe('Submit proposal');
      expect(parsed.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles titles with numbers that should not trigger priority', () => {
      const parsed = parseQuickAdd('Review 10 candidate resumes');
      expect(parsed.cleanTitle).toBe('Review 10 candidate resumes');
      expect(parsed.priority).toBe(0);
    });

    it('parses full multi-attribute syntax accurately', () => {
      const input =
        'Prepare board presentation tomorrow at 3pm #strategy #executive @Leadership !critical 🍅 every month';
      const parsed = parseQuickAdd(input);

      expect(parsed.cleanTitle).toBe('Prepare board presentation');
      expect(parsed.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.dueTime).toBe('15:00:00');
      expect(parsed.allDay).toBe(false);
      expect(parsed.priority).toBe(4);
      expect(parsed.tagNames).toEqual(['strategy', 'executive']);
      expect(parsed.listName).toBe('Leadership');
      expect(parsed.pomodoroRequested).toBe(true);
      expect(parsed.recurrenceRule).toBe('RRULE:FREQ=MONTHLY');
    });
  });
});
