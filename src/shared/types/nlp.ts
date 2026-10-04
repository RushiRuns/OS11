export interface ParsedTaskInput {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  allDay: boolean;
  priority: number;
  tagNames: string[];
  listName: string | null;
  areaName?: string | null;
  projectName?: string | null;
  pomodoroRequested: boolean;
  recurrenceRule: string | null;
  bucket?: 'anytime' | 'someday' | null;
}

export interface ParsedQuickAddResult extends ParsedTaskInput {
  cleanTitle: string;
}
