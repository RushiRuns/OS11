import * as chrono from 'chrono-node';
import type { ParsedTaskInput, ParsedQuickAddResult } from '../../shared/types/nlp.js';

export type { ParsedTaskInput, ParsedQuickAddResult };

const RECURRENCE_PATTERNS: Array<{ regex: RegExp; rrule: string }> = [
  { regex: /\bevery\s+weekday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { regex: /\bevery\s+monday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO' },
  { regex: /\bevery\s+tuesday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=TU' },
  { regex: /\bevery\s+wednesday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=WE' },
  { regex: /\bevery\s+thursday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=TH' },
  { regex: /\bevery\s+friday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=FR' },
  { regex: /\bevery\s+saturday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=SA' },
  { regex: /\bevery\s+sunday\b/i, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=SU' },
  { regex: /\b(?:every\s+day|daily)\b/i, rrule: 'RRULE:FREQ=DAILY' },
  { regex: /\b(?:every\s+week|weekly)\b/i, rrule: 'RRULE:FREQ=WEEKLY' },
  { regex: /\b(?:every\s+month|monthly)\b/i, rrule: 'RRULE:FREQ=MONTHLY' },
  { regex: /\b(?:every\s+year|yearly|annually)\b/i, rrule: 'RRULE:FREQ=YEARLY' },
];

export function parseQuickAdd(text: string): ParsedQuickAddResult {
  let workingText = text.trim();

  // 1. Pomodoro detection (🍅 or :tomato:)
  let pomodoroRequested = false;
  const pomodoroRegex = /(?:🍅|:tomato:)(?:[xX*]?\s*\d+)?/g;
  if (pomodoroRegex.test(workingText)) {
    pomodoroRequested = true;
    workingText = workingText.replace(pomodoroRegex, ' ');
  }

  // 2. Priority detection (!0-4, !low, !med, !high, !urgent, !crit, !critical, or !, !!, !!!)
  let priority = 0;
  const priorityRegex = /(?:^|\s)(!{1,3}|!(?:critical|crit|urgent|high|med|medium|low|none|[0-4]))(?=\s|$)/i;
  const priorityMatch = workingText.match(priorityRegex);
  if (priorityMatch) {
    const val = priorityMatch[1].toLowerCase();
    if (val === '!4' || val === '!critical' || val === '!crit') {
      priority = 4;
    } else if (val === '!3' || val === '!high' || val === '!urgent' || val === '!!!') {
      priority = 3;
    } else if (val === '!2' || val === '!med' || val === '!medium' || val === '!!') {
      priority = 2;
    } else if (val === '!1' || val === '!low' || val === '!') {
      priority = 1;
    } else {
      priority = 0;
    }
    workingText = workingText.replace(priorityRegex, ' ');
  }

  // 3. List detection (@list_name)
  let listName: string | null = null;
  const listRegex = /(?:^|\s)@([a-zA-Z0-9_\-\u00C0-\u017F]+)(?=\s|$)/;
  const listMatch = workingText.match(listRegex);
  if (listMatch) {
    listName = listMatch[1];
    workingText = workingText.replace(listRegex, ' ');
  }

  // 4. Tag detection (#tag_name)
  const tagNames: string[] = [];
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\u00C0-\u017F]+)(?=\s|$)/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(workingText)) !== null) {
    tagNames.push(tagMatch[1]);
  }
  workingText = workingText.replace(tagRegex, ' ');

  // 5. Recurrence detection (check specific patterns first)
  let recurrenceRule: string | null = null;
  for (const { regex, rrule } of RECURRENCE_PATTERNS) {
    if (regex.test(workingText)) {
      recurrenceRule = rrule;
      workingText = workingText.replace(regex, ' ');
      break;
    }
  }

  // 6. Chrono date & time extraction
  const parsed = chrono.parse(workingText);
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let allDay = true;

  if (parsed && parsed.length > 0) {
    const firstResult = parsed[0];
    const isCertainDate =
      firstResult.start.isCertain('day') ||
      firstResult.start.isCertain('weekday') ||
      firstResult.start.isCertain('month') ||
      firstResult.start.isCertain('hour');

    if (isCertainDate) {
      const dateObj = firstResult.start.date();
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      dueDate = `${year}-${month}-${day}`;

      if (firstResult.start.isCertain('hour')) {
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        dueTime = `${hours}:${minutes}:${seconds}`;
        allDay = false;
      }

      // Remove the parsed date text from the working string
      workingText = (
        workingText.slice(0, firstResult.index) +
        workingText.slice(firstResult.index + firstResult.text.length)
      );
    }
  }

  const cleanTitle =
    workingText
      .replace(/\s+/g, ' ')
      .replace(/\b(?:by|due|on|until)\s*$/i, '')
      .trim() || text.trim();

  return {
    title: cleanTitle,
    cleanTitle,
    dueDate,
    dueTime,
    allDay,
    priority,
    tagNames,
    listName,
    pomodoroRequested,
    recurrenceRule,
  };
}
