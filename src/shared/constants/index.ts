export const PRIORITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export const SMART_LISTS = {
  MY_DAY: 'smart_my_day',
  IMPORTANT: 'smart_important',
  PLANNED: 'smart_planned',
  ALL: 'smart_all',
  COMPLETED: 'smart_completed',
  TRASH: 'smart_trash',
} as const;

export const APP_DEFAULTS = {
  WINDOW_WIDTH: 960,
  WINDOW_HEIGHT: 700,
  MIN_WIDTH: 640,
  MIN_HEIGHT: 480,
  DEFAULT_LIST_ID: 'list_inbox',
  APP_TITLE: 'OS11',
} as const;
