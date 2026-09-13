import * as chrono from 'chrono-node';

export interface ParsedQuickAddResult {
  cleanTitle: string;
  dueDate: string | null;
  dueTime: string | null;
}

export function parseQuickAdd(text: string): ParsedQuickAddResult {
  const parsed = chrono.parse(text);
  if (!parsed || parsed.length === 0) {
    return {
      cleanTitle: text.trim(),
      dueDate: null,
      dueTime: null,
    };
  }

  const firstResult = parsed[0];
  const dateObj = firstResult.start.date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dueDate = `${year}-${month}-${day}`;

  let dueTime: string | null = null;
  if (firstResult.start.isCertain('hour')) {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    dueTime = `${hours}:${minutes}:${seconds}`;
  }

  // Remove the parsed date text from the title
  const cleanTitle = (
    text.slice(0, firstResult.index) + text.slice(firstResult.index + firstResult.text.length)
  )
    .replace(/\s+/g, ' ')
    .trim();

  return {
    cleanTitle: cleanTitle || text.trim(),
    dueDate,
    dueTime,
  };
}
