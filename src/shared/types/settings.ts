export interface SystemInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accent_color: string;
  reduce_motion: boolean;
  sound_effects: boolean;
  default_list_id: string;
  start_at_login: boolean;
}
