export interface ParsedTaskInput {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  allDay: boolean;
  priority: number;
  tagNames: string[];
  listName: string | null;
  pomodoroRequested: boolean;
  recurrenceRule: string | null;
}

export interface ParsedQuickAddResult extends ParsedTaskInput {
  cleanTitle: string;
}
