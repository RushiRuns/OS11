import type { Project, Section, Milestone, Task, ProjectTemplate } from '@shared/types/index.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProjectToCsv(
  project: Project,
  sections: Section[],
  tasks: Task[]
): void {
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const headers = ['Title', 'Section', 'Due Date', 'Priority', 'Status', 'Estimated Minutes', 'Notes'];

  const rows = tasks.map((task) => {
    const sectionName = task.section_id ? (sectionMap.get(task.section_id) ?? '') : '';
    const status = task.is_completed === 1 ? 'Completed' : 'Pending';
    const priorityLabels = ['None', 'Low', 'Medium', 'High', 'Critical'];
    const priority = priorityLabels[task.priority] ?? 'None';

    const escapeCsv = (val: string | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    return [
      escapeCsv(task.title),
      escapeCsv(sectionName),
      escapeCsv(task.due_date),
      escapeCsv(priority),
      escapeCsv(status),
      task.estimated_minutes ?? '',
      escapeCsv(task.notes ? task.notes.replace(/<[^>]*>?/gm, '') : ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_export.csv`;
  downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

export function exportProjectToMarkdown(
  project: Project,
  sections: Section[],
  tasks: Task[],
  milestones: Milestone[] = []
): void {
  const lines: string[] = [];

  lines.push(`# ${project.name}`);
  if (project.description) {
    lines.push(`\n>${project.description}\n`);
  }
  lines.push(`\n**Status**: ${project.status} | **Due Date**: ${project.due_date ?? 'None'}\n`);

  if (milestones.length > 0) {
    lines.push(`\n## Milestones\n`);
    for (const m of milestones) {
      const mark = m.is_completed === 1 ? '[x]' : '[ ]';
      lines.push(`- ${mark} **${m.title}** (Target: ${m.due_date})`);
    }
  }

  const tasksBySection = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.section_id ?? null;
    const list = tasksBySection.get(key) ?? [];
    list.push(t);
    tasksBySection.set(key, list);
  }

  for (const s of sections) {
    lines.push(`\n## ${s.name}\n`);
    const secTasks = tasksBySection.get(s.id) ?? [];
    if (secTasks.length === 0) {
      lines.push(`*(No tasks)*`);
    } else {
      for (const t of secTasks) {
        const mark = t.is_completed === 1 ? '[x]' : '[ ]';
        const details: string[] = [];
        if (t.due_date) details.push(`Due: ${t.due_date}`);
        if (t.priority > 0) details.push(`P${t.priority}`);
        if (t.estimated_minutes) details.push(`${t.estimated_minutes}m`);
        const metaStr = details.length > 0 ? ` *(${details.join(', ')})*` : '';
        lines.push(`- ${mark} ${t.title}${metaStr}`);
      }
    }
  }

  // Unsectioned tasks
  const unsectioned = tasksBySection.get(null) ?? [];
  if (unsectioned.length > 0) {
    lines.push(`\n## General\n`);
    for (const t of unsectioned) {
      const mark = t.is_completed === 1 ? '[x]' : '[ ]';
      lines.push(`- ${mark} ${t.title}`);
    }
  }

  const mdContent = lines.join('\n');
  const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_outline.md`;
  downloadFile(filename, mdContent, 'text/markdown;charset=utf-8;');
}

export async function exportProjectToPdf(): Promise<void> {
  try {
    const base64Data = await ipc.invoke<string>(IPC.PROJECTS.EXPORT_PDF);
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_report.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Fallback to browser print if IPC fails or webContents unavailable
    window.print();
  }
}

export function createProjectTemplate(
  project: Project,
  sections: Section[],
  tasks: Task[]
): ProjectTemplate {
  const tasksBySection = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.section_id) {
      const list = tasksBySection.get(t.section_id) ?? [];
      list.push(t);
      tasksBySection.set(t.section_id, list);
    }
  }

  const templateSections = sections.map((s) => ({
    name: s.name,
    tasks: (tasksBySection.get(s.id) ?? []).map((t) => ({
      title: t.title,
      notes: t.notes ?? null,
      priority: t.priority,
      estimated_minutes: t.estimated_minutes ?? null,
    })),
  }));

  return {
    name: `${project.name} Template`,
    description: project.description ?? null,
    color: project.color ?? null,
    icon: project.icon ?? null,
    sections: templateSections,
  };
}
