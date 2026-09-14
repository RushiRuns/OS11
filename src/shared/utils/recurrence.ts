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

export interface BuildCustomRRuleOptions {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  daysOfWeek?: string[];
}

export function buildCustomRRule(options: BuildCustomRRuleOptions): string {
  const parts: string[] = [`FREQ=${options.frequency}`];
  if (options.interval > 1) {
    parts.push(`INTERVAL=${options.interval}`);
  }
  if (options.frequency === 'WEEKLY' && options.daysOfWeek && options.daysOfWeek.length > 0) {
    parts.push(`BYDAY=${options.daysOfWeek.join(',')}`);
  }
  return `RRULE:${parts.join(';')}`;
}

export function calculateNextOccurrence(
  ruleStr: string,
  basis: 'fixed' | 'after_completion' | null | undefined,
  dueDateStr?: string | null,
  completionDate: Date = new Date()
): Date | null {
  if (!isValidRRule(ruleStr)) return null;

  try {
    if (basis === 'after_completion') {
      const rule = rrulestr(ruleStr, { dtstart: completionDate });
      return rule.after(completionDate);
    } else {
      let baseDate: Date;
      if (dueDateStr) {
        // Normalize date string (avoid timezone day shifts for YYYY-MM-DD)
        const parts = dueDateStr.split('T')[0].split('-');
        if (parts.length === 3) {
          baseDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        } else {
          baseDate = new Date(dueDateStr);
        }
      } else {
        baseDate = completionDate;
      }
      const rule = rrulestr(ruleStr, { dtstart: baseDate });
      return rule.after(baseDate);
    }
  } catch {
    return null;
  }
}
