export interface SystemInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
}

export interface SettingsMap {
  theme: 'auto' | 'dark' | 'light' | 'system';
  accent_color: string;
  font_size: 'sm' | 'md' | 'lg';
  font_family: string;
  density: 'compact' | 'comfortable' | 'spacious';
  sidebar_position: 'left' | 'right' | 'hidden';
  launch_at_login: boolean;
  day_starts_at: string;
  pomodoro_work_minutes: number;
  pomodoro_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_sessions_before_long_break: number;
  vim_keybindings: boolean;
  active_profile_preset: string;
  app_lock_enabled: boolean;
  reduce_motion: boolean;
  task_card_style: 'default' | 'minimal' | 'detailed';
}

export type SettingKey = keyof SettingsMap;

export interface AppSettings {
  theme: 'dark' | 'light' | 'system' | 'auto';
  accent_color: string;
  reduce_motion: boolean;
  sound_effects?: boolean;
  default_list_id?: string;
  start_at_login?: boolean;
  sidebar_position?: 'left' | 'right' | 'hidden';
  density?: 'compact' | 'comfortable' | 'spacious';
  font_size?: 'sm' | 'md' | 'lg';
}
