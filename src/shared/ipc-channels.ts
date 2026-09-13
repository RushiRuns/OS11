export const IPC = {
  TASKS: {
    GET_ALL: 'tasks:get-all',
    GET_BY_ID: 'tasks:get-by-id',
    CREATE: 'tasks:create',
    UPDATE: 'tasks:update',
    DELETE: 'tasks:delete',
    TOGGLE_COMPLETE: 'tasks:toggle-complete',
  },
  LISTS: {
    GET_ALL: 'lists:get-all',
    CREATE: 'lists:create',
  },
  PROJECTS: {
    GET_ALL: 'projects:get-all',
    CREATE: 'projects:create',
  },
  SETTINGS: {
    GET_ALL: 'settings:get-all',
    GET: 'settings:get',
    SET: 'settings:set',
  },
  SYSTEM: {
    GET_INFO: 'system:get-info',
    MINIMIZE: 'system:minimize',
    MAXIMIZE: 'system:maximize',
    CLOSE: 'system:close',
  },
} as const;
