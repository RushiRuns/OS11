const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface DueLabelResult {
  label: string;
  isOverdue: boolean;
}

export function formatDueLabel(
  dueDate?: string | null,
  dueTime?: string | null,
  allDay?: number,
  now: Date = new Date()
): DueLabelResult | null {
  if (!dueDate) return null;

  let datePart = dueDate;
  let timeStr: string | null = null;

  if (dueDate.includes('T')) {
    const [d, t] = dueDate.split('T');
    datePart = d;
    if (!dueTime && t && allDay !== 1) {
      timeStr = t.slice(0, 5);
    }
  }

  if (dueTime && allDay !== 1) {
    timeStr = dueTime.slice(0, 5);
  }

  const parts = datePart.split('-');
  if (parts.length !== 3) return null;

  const targetYear = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(targetYear) || isNaN(monthIndex) || isNaN(day)) return null;

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const nowDate = now.getDate();

  const todayMidnight = new Date(nowYear, nowMonth, nowDate, 0, 0, 0, 0);
  const targetDateMidnight = new Date(targetYear, monthIndex, day, 0, 0, 0, 0);

  const diffMs = targetDateMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let baseDateLabel: string;
  if (diffDays === 0) {
    baseDateLabel = 'Today';
  } else if (diffDays === 1) {
    baseDateLabel = 'Tomorrow';
  } else if (diffDays === -1) {
    baseDateLabel = 'Yesterday';
  } else if (targetYear === nowYear) {
    baseDateLabel = `${day} ${MONTHS[monthIndex]}`;
  } else {
    baseDateLabel = `${day} ${MONTHS[monthIndex]} ${targetYear}`;
  }

  let formattedTime: string | null = null;
  let isOverdue = false;

  if (timeStr && allDay !== 1) {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      formattedTime = `${hours12}:${minutes} ${ampm}`;

      const targetDateTime = new Date(targetYear, monthIndex, day, hours, parseInt(minutes, 10), 0, 0);
      isOverdue = targetDateTime.getTime() < now.getTime();
    }
  } else {
    isOverdue = targetDateMidnight.getTime() < todayMidnight.getTime();
  }

  const finalLabel = formattedTime ? `${baseDateLabel}, ${formattedTime}` : baseDateLabel;

  return {
    label: finalLabel,
    isOverdue,
  };
}
