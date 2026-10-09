export type ShortcutActionId =
  | 'command_palette'
  | 'toggle_focus_mode'
  | 'nav_today'
  | 'nav_agenda'
  | 'open_preferences'
  | 'nav_anytime'
  | 'nav_someday'
  | 'nav_waiting'
  | 'quick_capture_omnibar'
  | 'quick_add_modal'
  | 'complete_task'
  | 'star_task'
  | 'delete_task'
  | 'duplicate_task'
  | 'toggle_theme'
  | 'undo'
  | 'redo'
  | 'toggle_dev_tools'
  | 'search_tasks'
  | 'toggle_detail'
  | 'global_show_app'
  | 'global_toggle_app'
  | 'global_always_on_top';

export type ShortcutCategory =
  | 'Navigation'
  | 'Tasks'
  | 'Editing'
  | 'Appearance'
  | 'System'
  | 'Developer';

export interface ShortcutDefinition {
  id: ShortcutActionId | string;
  label: string;
  category: ShortcutCategory;
  defaultKeys: string[];
  isGlobal?: boolean;
  description?: string;
}

export type ShortcutMap = Record<string, string[]>;
