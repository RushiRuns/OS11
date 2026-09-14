import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  Section,
  CreateSectionPayload,
  UpdateSectionPayload,
  Milestone,
  CreateMilestonePayload,
  UpdateMilestonePayload,
  TaskDependency,
  ProjectTemplate,
  NotificationHistoryItem,
} from '@shared/types/index.js';

export interface ProjectState {
  projectsById: Record<string, Project>;
  sectionsById: Record<string, Section>;
  milestonesById: Record<string, Milestone>;
  dependenciesByTaskId: Record<string, string[]>;
  selectedProjectId: string | null;
  activityFeed: NotificationHistoryItem[];
  isLoading: boolean;
  isLoaded: boolean;

  // Actions
  setSelectedProjectId: (id: string | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  updateProject: (id: string, fields: UpdateProjectPayload) => Promise<Project>;
  archiveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  loadSections: (projectId: string) => Promise<void>;
  createSection: (payload: CreateSectionPayload) => Promise<Section>;
  updateSection: (id: string, fields: UpdateSectionPayload) => Promise<Section>;
  reorderSections: (projectId: string, updates: { id: string; sortOrder: number }[]) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  loadMilestones: (projectId: string) => Promise<void>;
  createMilestone: (payload: CreateMilestonePayload) => Promise<Milestone>;
  updateMilestone: (id: string, fields: UpdateMilestonePayload) => Promise<Milestone>;
  toggleMilestone: (id: string) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;

  loadDependencies: (projectId?: string) => Promise<void>;
  loadDependenciesForTask: (taskId: string) => Promise<string[]>;
  addDependency: (taskId: string, dependsOnId: string) => Promise<void>;
  removeDependency: (taskId: string, dependsOnId: string) => Promise<void>;

  loadActivity: (projectId: string) => Promise<void>;
  importTemplate: (template: ProjectTemplate) => Promise<Project>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectsById: {},
  sectionsById: {},
  milestonesById: {},
  dependenciesByTaskId: {},
  selectedProjectId: null,
  activityFeed: [],
  isLoading: false,
  isLoaded: false,

  setSelectedProjectId: (id: string | null) => {
    set({ selectedProjectId: id });
    if (id) {
      get().loadSections(id);
      get().loadMilestones(id);
      get().loadDependencies(id);
      get().loadActivity(id);
    }
  },

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await ipc.invoke<Project[]>(IPC.PROJECTS.GET_ALL);
      const projectsById: Record<string, Project> = {};
      for (const p of projects) {
        projectsById[p.id] = p;
      }

      let selectedProjectId = get().selectedProjectId;
      if (!selectedProjectId && projects.length > 0) {
        selectedProjectId = projects[0].id;
      }

      set({
        projectsById,
        selectedProjectId,
        isLoaded: true,
        isLoading: false,
      });

      if (selectedProjectId) {
        get().loadSections(selectedProjectId);
        get().loadMilestones(selectedProjectId);
        get().loadDependencies(selectedProjectId);
        get().loadActivity(selectedProjectId);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      set({ isLoading: false });
    }
  },

  createProject: async (payload: CreateProjectPayload) => {
    const tempId = `proj_${Date.now()}`;
    const optimistic: Project = {
      id: tempId,
      name: payload.name.trim(),
      description: payload.description ?? null,
      color: payload.color ?? 'var(--tag-blue)',
      icon: payload.icon ?? '📁',
      status: payload.status ?? 'active',
      due_date: payload.due_date ?? null,
      default_view: payload.default_view ?? 'list',
      sort_order: payload.sort_order ?? Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      projectsById: { ...state.projectsById, [tempId]: optimistic },
      selectedProjectId: state.selectedProjectId ?? tempId,
    }));

    try {
      const created = await ipc.invoke<Project>(IPC.PROJECTS.CREATE, payload);
      set((state) => {
        const next = { ...state.projectsById };
        delete next[tempId];
        next[created.id] = created;
        return {
          projectsById: next,
          selectedProjectId: state.selectedProjectId === tempId ? created.id : state.selectedProjectId,
        };
      });

      // Default section for new projects
      await get().createSection({ project_id: created.id, name: 'To Do', sort_order: 0 });
      await get().createSection({ project_id: created.id, name: 'In Progress', sort_order: 1 });
      await get().createSection({ project_id: created.id, name: 'Done', sort_order: 2 });

      return created;
    } catch (err) {
      set((state) => {
        const next = { ...state.projectsById };
        delete next[tempId];
        return { projectsById: next };
      });
      throw err;
    }
  },

  updateProject: async (id: string, fields: UpdateProjectPayload) => {
    const existing = get().projectsById[id];
    if (!existing) throw new Error(`Project ${id} not found`);

    const updated: Project = {
      ...existing,
      ...fields,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      projectsById: { ...state.projectsById, [id]: updated },
    }));

    try {
      const persisted = await ipc.invoke<Project>(IPC.PROJECTS.UPDATE, { id, fields });
      set((state) => ({
        projectsById: { ...state.projectsById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      set((state) => ({
        projectsById: { ...state.projectsById, [id]: existing },
      }));
      throw err;
    }
  },

  archiveProject: async (id: string) => {
    const existing = get().projectsById[id];
    if (!existing) return;

    set((state) => ({
      projectsById: {
        ...state.projectsById,
        [id]: { ...existing, status: 'archived', updated_at: new Date().toISOString() },
      },
    }));

    try {
      await ipc.invoke(IPC.PROJECTS.ARCHIVE, id);
    } catch (err) {
      set((state) => ({
        projectsById: { ...state.projectsById, [id]: existing },
      }));
      throw err;
    }
  },

  deleteProject: async (id: string) => {
    const existing = get().projectsById[id];
    if (!existing) return;

    set((state) => {
      const next = { ...state.projectsById };
      delete next[id];
      const remainingIds = Object.keys(next);
      return {
        projectsById: next,
        selectedProjectId: state.selectedProjectId === id ? (remainingIds[0] ?? null) : state.selectedProjectId,
      };
    });

    try {
      await ipc.invoke(IPC.PROJECTS.DELETE, id);
    } catch (err) {
      set((state) => ({
        projectsById: { ...state.projectsById, [id]: existing },
      }));
      throw err;
    }
  },

  loadSections: async (projectId: string) => {
    try {
      const sections = await ipc.invoke<Section[]>(IPC.SECTIONS.GET_ALL, projectId);
      set((state) => {
        const next = { ...state.sectionsById };
        for (const s of sections) {
          next[s.id] = s;
        }
        return { sectionsById: next };
      });
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  },

  createSection: async (payload: CreateSectionPayload) => {
    const tempId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: Section = {
      id: tempId,
      project_id: payload.project_id,
      name: payload.name.trim(),
      sort_order: payload.sort_order ?? Date.now(),
      is_collapsed: payload.is_collapsed ? 1 : 0,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      sectionsById: { ...state.sectionsById, [tempId]: optimistic },
    }));

    try {
      const created = await ipc.invoke<Section>(IPC.SECTIONS.CREATE, payload);
      set((state) => {
        const next = { ...state.sectionsById };
        delete next[tempId];
        next[created.id] = created;
        return { sectionsById: next };
      });
      return created;
    } catch (err) {
      set((state) => {
        const next = { ...state.sectionsById };
        delete next[tempId];
        return { sectionsById: next };
      });
      throw err;
    }
  },

  updateSection: async (id: string, fields: UpdateSectionPayload) => {
    const existing = get().sectionsById[id];
    if (!existing) throw new Error(`Section ${id} not found`);

    const updated: Section = {
      ...existing,
      ...fields,
      is_collapsed:
        fields.is_collapsed !== undefined
          ? fields.is_collapsed
            ? 1
            : 0
          : existing.is_collapsed,
    };

    set((state) => ({
      sectionsById: { ...state.sectionsById, [id]: updated },
    }));

    try {
      const persisted = await ipc.invoke<Section>(IPC.SECTIONS.UPDATE, { id, fields });
      set((state) => ({
        sectionsById: { ...state.sectionsById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      set((state) => ({
        sectionsById: { ...state.sectionsById, [id]: existing },
      }));
      throw err;
    }
  },

  reorderSections: async (projectId: string, updates: { id: string; sortOrder: number }[]) => {
    set((state) => {
      const next = { ...state.sectionsById };
      for (const u of updates) {
        if (next[u.id]) {
          next[u.id] = { ...next[u.id], sort_order: u.sortOrder };
        }
      }
      return { sectionsById: next };
    });

    try {
      for (const u of updates) {
        await ipc.invoke(IPC.SECTIONS.REORDER, { id: u.id, sortOrder: u.sortOrder });
      }
    } catch (err) {
      console.error('Failed to reorder sections:', err);
      get().loadSections(projectId);
    }
  },

  deleteSection: async (id: string) => {
    const existing = get().sectionsById[id];
    if (!existing) return;

    set((state) => {
      const next = { ...state.sectionsById };
      delete next[id];
      return { sectionsById: next };
    });

    try {
      await ipc.invoke(IPC.SECTIONS.DELETE, id);
    } catch (err) {
      set((state) => ({
        sectionsById: { ...state.sectionsById, [id]: existing },
      }));
      throw err;
    }
  },

  loadMilestones: async (projectId: string) => {
    try {
      const milestones = await ipc.invoke<Milestone[]>(IPC.MILESTONES.GET_ALL, projectId);
      set((state) => {
        const next = { ...state.milestonesById };
        for (const m of milestones) {
          next[m.id] = m;
        }
        return { milestonesById: next };
      });
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
  },

  createMilestone: async (payload: CreateMilestonePayload) => {
    const tempId = `ms_${Date.now()}`;
    const optimistic: Milestone = {
      id: tempId,
      project_id: payload.project_id,
      title: payload.title.trim(),
      due_date: payload.due_date,
      is_completed: payload.is_completed ? 1 : 0,
      sort_order: payload.sort_order ?? Date.now(),
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      milestonesById: { ...state.milestonesById, [tempId]: optimistic },
    }));

    try {
      const created = await ipc.invoke<Milestone>(IPC.MILESTONES.CREATE, payload);
      set((state) => {
        const next = { ...state.milestonesById };
        delete next[tempId];
        next[created.id] = created;
        return { milestonesById: next };
      });
      return created;
    } catch (err) {
      set((state) => {
        const next = { ...state.milestonesById };
        delete next[tempId];
        return { milestonesById: next };
      });
      throw err;
    }
  },

  updateMilestone: async (id: string, fields: UpdateMilestonePayload) => {
    const existing = get().milestonesById[id];
    if (!existing) throw new Error(`Milestone ${id} not found`);

    const updated: Milestone = {
      ...existing,
      ...fields,
      is_completed:
        fields.is_completed !== undefined
          ? fields.is_completed
            ? 1
            : 0
          : existing.is_completed,
    };

    set((state) => ({
      milestonesById: { ...state.milestonesById, [id]: updated },
    }));

    try {
      const persisted = await ipc.invoke<Milestone>(IPC.MILESTONES.UPDATE, { id, fields });
      set((state) => ({
        milestonesById: { ...state.milestonesById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      set((state) => ({
        milestonesById: { ...state.milestonesById, [id]: existing },
      }));
      throw err;
    }
  },

  toggleMilestone: async (id: string) => {
    const existing = get().milestonesById[id];
    if (!existing) return;
    const isCompleted = existing.is_completed === 1 ? 0 : 1;
    await get().updateMilestone(id, { is_completed: isCompleted });
  },

  deleteMilestone: async (id: string) => {
    const existing = get().milestonesById[id];
    if (!existing) return;

    set((state) => {
      const next = { ...state.milestonesById };
      delete next[id];
      return { milestonesById: next };
    });

    try {
      await ipc.invoke(IPC.MILESTONES.DELETE, id);
    } catch (err) {
      set((state) => ({
        milestonesById: { ...state.milestonesById, [id]: existing },
      }));
      throw err;
    }
  },

  loadDependencies: async (projectId?: string) => {
    try {
      const deps = await ipc.invoke<TaskDependency[]>(IPC.DEPENDENCIES.GET_ALL, projectId);
      const map: Record<string, string[]> = {};
      for (const d of deps) {
        if (!map[d.task_id]) {
          map[d.task_id] = [];
        }
        map[d.task_id].push(d.depends_on_id);
      }
      set({ dependenciesByTaskId: map });
    } catch (err) {
      console.error('Failed to load dependencies:', err);
    }
  },

  loadDependenciesForTask: async (taskId: string) => {
    try {
      const deps = await ipc.invoke<string[]>(IPC.DEPENDENCIES.GET_FOR_TASK, taskId);
      set((state) => ({
        dependenciesByTaskId: {
          ...state.dependenciesByTaskId,
          [taskId]: deps,
        },
      }));
      return deps;
    } catch (err) {
      console.error('Failed to load dependencies for task:', err);
      return [];
    }
  },

  addDependency: async (taskId: string, dependsOnId: string) => {
    const current = get().dependenciesByTaskId[taskId] ?? [];
    if (current.includes(dependsOnId)) return;

    set((state) => ({
      dependenciesByTaskId: {
        ...state.dependenciesByTaskId,
        [taskId]: [...current, dependsOnId],
      },
    }));

    try {
      await ipc.invoke(IPC.DEPENDENCIES.ADD, { taskId, dependsOnId });
    } catch (err) {
      set((state) => ({
        dependenciesByTaskId: {
          ...state.dependenciesByTaskId,
          [taskId]: current,
        },
      }));
      throw err;
    }
  },

  removeDependency: async (taskId: string, dependsOnId: string) => {
    const current = get().dependenciesByTaskId[taskId] ?? [];
    const next = current.filter((id) => id !== dependsOnId);

    set((state) => ({
      dependenciesByTaskId: {
        ...state.dependenciesByTaskId,
        [taskId]: next,
      },
    }));

    try {
      await ipc.invoke(IPC.DEPENDENCIES.REMOVE, { taskId, dependsOnId });
    } catch (err) {
      set((state) => ({
        dependenciesByTaskId: {
          ...state.dependenciesByTaskId,
          [taskId]: current,
        },
      }));
      throw err;
    }
  },

  loadActivity: async (projectId: string) => {
    try {
      const items = await ipc.invoke<NotificationHistoryItem[]>(IPC.PROJECTS.GET_ACTIVITY, projectId);
      set({ activityFeed: items });
    } catch (err) {
      console.error('Failed to load project activity:', err);
    }
  },

  importTemplate: async (template: ProjectTemplate) => {
    const project = await get().createProject({
      name: template.name,
      description: template.description,
      color: template.color,
      icon: template.icon,
    });

    // Import template sections & placeholder tasks
    for (let sIdx = 0; sIdx < template.sections.length; sIdx++) {
      const secData = template.sections[sIdx];
      const section = await get().createSection({
        project_id: project.id,
        name: secData.name,
        sort_order: sIdx,
      });

      for (const t of secData.tasks) {
        try {
          await ipc.invoke(IPC.TASKS.CREATE, {
            title: t.title,
            notes: t.notes ?? null,
            priority: t.priority ?? 0,
            estimated_minutes: t.estimated_minutes ?? null,
            project_id: project.id,
            section_id: section.id,
            list_id: 'smart_all',
          });
        } catch (taskErr) {
          console.error('Failed creating template task:', taskErr);
        }
      }
    }

    return project;
  },
}));

export default useProjectStore;
