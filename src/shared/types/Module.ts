export interface Module {
  module_name: string;
  is_enabled: number;
}

export type ModuleName =
  | 'my_day'
  | 'project_management'
  | 'pomodoro'
  | 'agenda'
  | 'goals_habits'
  | 'dashboard'
  | 'file_attachments'
  | 'nlp_parsing'
  | 'vim_keybindings'
  | 'animated_backgrounds'
  | 'habit_tracker'
  | 'collaboration'
  | 'companion_sync';
