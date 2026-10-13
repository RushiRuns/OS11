import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Regression: Grouped tasks priority indicator visibility in TaskList', () => {
  const taskListCssPath = path.resolve(process.cwd(), 'src/renderer/features/tasks/TaskList.module.css');
  const taskCardCssPath = path.resolve(process.cwd(), 'src/renderer/features/tasks/TaskCard.module.css');

  const taskListCss = fs.readFileSync(taskListCssPath, 'utf-8');
  const taskCardCss = fs.readFileSync(taskCardCssPath, 'utf-8');

  it('TC-GPI-01: verifies TaskCard uses a negative margin and left: 0 priority indicator', () => {
    // TaskCard shifts cards left by -12px so checkboxes align with the Quick Add icon
    expect(taskCardCss).toMatch(/\.taskCard\s*\{[^}]*margin-left:\s*-12px;/);
    // Priority indicator lines are rendered via ::before at left: 0
    expect(taskCardCss).toMatch(/\.priority[1-4]::before\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*0;/);
  });

  it('TC-GPI-02: verifies collapsibleInner enforces overflow: hidden for accordion collapse', () => {
    // Collapsible group wrapper relies on overflow: hidden for height transitions
    expect(taskListCss).toMatch(/\.collapsibleInner\s*\{[^}]*overflow:\s*hidden;/);
  });

  it('TC-GPI-03: ensures groupedTaskList compensates for -12px margin with padding-left: 12px to prevent clipping priority indicator', () => {
    // If groupedTaskList lacks padding-left: 12px, .taskCard (margin-left: -12px) extends into
    // negative coordinates inside .collapsibleInner (overflow: hidden), clipping the priority indicator line.
    const groupedTaskListMatch = taskListCss.match(/\.groupedTaskList\s*\{([^}]+)\}/);
    expect(groupedTaskListMatch).not.toBeNull();

    const groupedTaskListRule = groupedTaskListMatch![1];
    expect(groupedTaskListRule).toMatch(/padding-left:\s*12px/);
    expect(groupedTaskListRule).toMatch(/box-sizing:\s*border-box/);
  });
});
