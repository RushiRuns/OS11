import { rrulestr } from 'rrule';

export function isValidRRule(str: string): boolean {
  if (!str || typeof str !== 'string' || str.trim().length === 0) {
    return false;
  }
  try {
    rrulestr(str);
    return true;
  } catch {
    return false;
  }
}

export function nextOccurrence(rruleString: string, fromDate: Date = new Date()): Date | null {
  try {
    const rule = rrulestr(rruleString, { dtstart: fromDate });
    return rule.after(fromDate);
  } catch {
    return null;
  }
}

export function humanReadableRRule(str: string): string {
  try {
    const rule = rrulestr(str);
    return rule.toText();
  } catch {
    return str;
  }
}

export function expandOccurrences(str: string, from: Date, to: Date): Date[] {
  try {
    const rule = rrulestr(str, { dtstart: from });
    return rule.between(from, to, true);
  } catch {
    return [];
  }
}
