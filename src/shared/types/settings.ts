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
  font_size: 'sm' | 'md' | 'lg' | string;
  font_family: string;
  density: 'compact' | 'comfortable' | 'spacious';
  sidebar_position: 'left' | 'right' | 'hidden';
  launch_at_login: boolean;
  day_starts_at: string;
  default_list_id?: string;
  pomodoro_work_minutes: number;
  pomodoro_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_sessions_before_long_break: number;
  vim_keybindings: boolean;
  active_profile_preset: string;
  app_lock_enabled: boolean;
  reduce_motion: boolean;
  task_card_style: 'default' | 'minimal' | 'detailed';
  // Notifications
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  notification_sound: string;
  sound_effects_enabled: boolean;
  // Privacy
  stealth_mode: boolean;
  auto_archive_days: number;
  // Phase 18: Onboarding, Review & Ambient
  onboarding_completed: boolean;
  weekly_review_enabled: boolean;
  weekly_review_time: string;
  weekly_review_day: number;
  last_weekly_review_week: string;
  monthly_review_enabled: boolean;
  monthly_review_day: number;
  last_monthly_review_month: string;
  ambient_sound_volume: number;
  ambient_sound_track: string;
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
  font_size?: 'sm' | 'md' | 'lg' | string;
}

