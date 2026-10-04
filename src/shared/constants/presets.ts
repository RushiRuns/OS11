export type ProfilePreset = 'minimalist' | 'gtd' | 'focus' | 'custom';

export const PRESET_MODULE_MAP: Record<Exclude<ProfilePreset, 'custom'>, string[]> = {
  minimalist: ['my_day'],
  gtd: [
    'my_day',
    'project_management',
    'agenda',
    'goals_habits',
    'anytime',
    'someday',
    'waiting_for',
  ],
  focus: ['my_day', 'pomodoro', 'agenda'],
};
