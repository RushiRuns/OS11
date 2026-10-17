import type { ShortcutDefinition } from '../types/shortcuts.js';

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'command_palette',
    label: 'Open Command Palette',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'K'],
  },
  {
    id: 'toggle_focus_mode',
    label: 'Toggle Full-Screen Focus Mode',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'Shift', 'F'],
  },
  {
    id: 'nav_today',
    label: 'Navigate to Today (My Day)',
    category: 'Navigation',
    defaultKeys: ['G', 'T'],
  },
  {
    id: 'nav_agenda',
    label: 'Navigate to Agenda View',
    category: 'Navigation',
    defaultKeys: ['G', 'A'],
  },
  {
    id: 'open_preferences',
    label: 'Open Global Preferences',
    category: 'Navigation',
    defaultKeys: ['Ctrl', ','],
  },
  {
    id: 'nav_anytime',
    label: 'Navigate to Anytime View',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'Shift', 'A'],
  },
  {
    id: 'nav_someday',
    label: 'Navigate to Someday / Maybe View',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'Shift', 'S'],
  },
  {
    id: 'nav_waiting',
    label: 'Navigate to Waiting For View',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'Shift', 'W'],
  },
  {
    id: 'quick_capture_omnibar',
    label: 'Quick Add Task (Global Omnibar)',
    category: 'Tasks',
    defaultKeys: ['Ctrl', 'Space'],
    isGlobal: true,
  },
  {
    id: 'quick_add_modal',
    label: 'Open Quick-Add Modal',
    category: 'Tasks',
    defaultKeys: ['Ctrl', 'N'],
    isGlobal: true,
  },
  {
    id: 'new_task_in_view',
    label: 'New Task in Current View',
    category: 'Tasks',
    defaultKeys: ['C'],
  },
  {
    id: 'complete_task',
    label: 'Mark Selected Task Complete',
    category: 'Tasks',
    defaultKeys: ['Space'],
  },
  {
    id: 'star_task',
    label: 'Star / Unstar Task',
    category: 'Tasks',
    defaultKeys: ['S'],
  },
  {
    id: 'delete_task',
    label: 'Delete Task (Move to Trash)',
    category: 'Tasks',
    defaultKeys: ['Delete'],
  },
  {
    id: 'duplicate_task',
    label: 'Duplicate Selected Task',
    category: 'Tasks',
    defaultKeys: ['Ctrl', 'D'],
  },
  {
    id: 'toggle_detail',
    label: 'Toggle Task Detail Panel',
    category: 'Tasks',
    defaultKeys: ['Ctrl', 'I'],
  },
  {
    id: 'search_tasks',
    label: 'Search Tasks',
    category: 'Navigation',
    defaultKeys: ['Ctrl', 'F'],
  },
  {
    id: 'toggle_theme',
    label: 'Toggle Theme',
    category: 'Appearance',
    defaultKeys: ['Ctrl', 'Shift', 'T'],
  },
  {
    id: 'undo',
    label: 'Undo Last Action',
    category: 'Editing',
    defaultKeys: ['Ctrl', 'Z'],
  },
  {
    id: 'redo',
    label: 'Redo Last Action',
    category: 'Editing',
    defaultKeys: ['Ctrl', 'Shift', 'Z'],
  },
  {
    id: 'toggle_dev_tools',
    label: 'Toggle Developer Tools',
    category: 'Developer',
    defaultKeys: ['F12'],
  },
  {
    id: 'global_show_app',
    label: 'Show & Focus Main Window',
    category: 'System',
    defaultKeys: ['Ctrl', 'Shift', 'Space'],
    isGlobal: true,
  },
  {
    id: 'global_toggle_app',
    label: 'Toggle App Visibility',
    category: 'System',
    defaultKeys: ['Ctrl', 'Shift', 'H'],
    isGlobal: true,
  },
  {
    id: 'global_always_on_top',
    label: 'Toggle Always on Top',
    category: 'System',
    defaultKeys: ['Ctrl', 'Shift', 'T'],
    isGlobal: true,
  },
];

export const DEFAULT_SHORTCUTS_MAP: Record<string, string[]> = DEFAULT_SHORTCUTS.reduce(
  (acc, item) => {
    acc[item.id] = [...item.defaultKeys];
    return acc;
  },
  {} as Record<string, string[]>
);

/**
 * Normalizes an array of keys into a consistent order:
 * Modifiers first (Ctrl, Alt, Shift, Meta), followed by the primary key.
 */
export function normalizeKeyCombo(keys: string[]): string[] {
  const modifiers: string[] = [];
  const primaryKeys: string[] = [];

  for (const k of keys) {
    const raw = k.trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      if (!modifiers.includes('Ctrl')) modifiers.push('Ctrl');
    } else if (lower === 'alt' || lower === 'option') {
      if (!modifiers.includes('Alt')) modifiers.push('Alt');
    } else if (lower === 'shift') {
      if (!modifiers.includes('Shift')) modifiers.push('Shift');
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
      if (!modifiers.includes('Meta')) modifiers.push('Meta');
    } else {
      // Primary key: standardize display (e.g. 'p' -> 'P', 'space' -> 'Space')
      const formatted =
        raw.length === 1
          ? raw.toUpperCase()
          : raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!primaryKeys.includes(formatted)) {
        primaryKeys.push(formatted);
      }
    }
  }

  // Desired modifier order: Ctrl, Alt, Shift, Meta
  const orderedMods: string[] = [];
  if (modifiers.includes('Ctrl')) orderedMods.push('Ctrl');
  if (modifiers.includes('Alt')) orderedMods.push('Alt');
  if (modifiers.includes('Shift')) orderedMods.push('Shift');
  if (modifiers.includes('Meta')) orderedMods.push('Meta');

  return [...orderedMods, ...primaryKeys];
}

/**
 * Evaluates whether an incoming KeyboardEvent matches a given key combo.
 */
export function matchesShortcut(event: KeyboardEvent, combo: string[]): boolean {
  if (!combo || combo.length === 0) return false;

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const hasCtrl = combo.some((k) => k.toLowerCase() === 'ctrl' || k.toLowerCase() === 'control');
  const hasShift = combo.some((k) => k.toLowerCase() === 'shift');
  const hasAlt = combo.some((k) => k.toLowerCase() === 'alt' || k.toLowerCase() === 'option');
  const hasMeta = combo.some(
    (k) => k.toLowerCase() === 'meta' || k.toLowerCase() === 'cmd' || k.toLowerCase() === 'command'
  );

  // In Electron/web applications, on Mac Ctrl often maps to Cmd (Meta)
  const actualCtrlOrMeta = isMac ? event.metaKey || event.ctrlKey : event.ctrlKey;
  if (hasCtrl) {
    if (!actualCtrlOrMeta) return false;
  } else if (!hasMeta && actualCtrlOrMeta) {
    return false;
  }

  if (hasShift !== event.shiftKey) return false;
  if (hasAlt !== event.altKey) return false;

  // Find the primary non-modifier key
  const primaryKeys = combo.filter((k) => {
    const l = k.toLowerCase();
    return (
      l !== 'ctrl' &&
      l !== 'control' &&
      l !== 'alt' &&
      l !== 'option' &&
      l !== 'shift' &&
      l !== 'meta' &&
      l !== 'cmd' &&
      l !== 'command'
    );
  });

  if (primaryKeys.length === 0) return false;

  // Single combo matching
  const targetKey = primaryKeys[primaryKeys.length - 1].toLowerCase();
  const eventKey = event.key ? event.key.toLowerCase() : '';

  if (targetKey === 'space' || targetKey === ' ') {
    return eventKey === ' ' || eventKey === 'space';
  }

  if (targetKey === 'delete') {
    return eventKey === 'delete';
  }

  if (targetKey === 'backspace') {
    return eventKey === 'backspace';
  }

  if (targetKey === 'enter' || targetKey === 'return') {
    return eventKey === 'enter';
  }

  return eventKey === targetKey;
}

/**
 * Converts a key combo to an Electron global accelerator string.
 * e.g. ['Ctrl', 'Shift', 'Space'] -> 'CommandOrControl+Shift+Space'
 */
export function toElectronAccelerator(combo: string[]): string {
  const parts: string[] = [];
  const normalized = normalizeKeyCombo(combo);

  for (const k of normalized) {
    const l = k.toLowerCase();
    if (l === 'ctrl' || l === 'control' || l === 'meta' || l === 'cmd') {
      if (!parts.includes('CommandOrControl')) parts.push('CommandOrControl');
    } else if (l === 'alt' || l === 'option') {
      if (!parts.includes('Alt')) parts.push('Alt');
    } else if (l === 'shift') {
      if (!parts.includes('Shift')) parts.push('Shift');
    } else {
      parts.push(k);
    }
  }

  return parts.join('+');
}
