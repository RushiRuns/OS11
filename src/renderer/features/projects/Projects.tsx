import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { ProjectHeader } from './ProjectHeader.js';
import { ProjectListView } from './ProjectListView.js';
import { ProjectBoardView } from './ProjectBoardView.js';
import { ProjectTimelineView } from './ProjectTimelineView.js';
import { ProjectCalendarView } from './ProjectCalendarView.js';
import { ProjectTableView } from './ProjectTableView.js';
import { MilestonesModal } from './MilestonesModal.js';
import { TemplateModal } from './TemplateModal.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { ProjectViewMode } from './ViewSwitcher.js';
import type { Task } from '@shared/types/index.js';
import styles from './Projects.module.css';

export function Projects(): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const {
    projectsById,
    selectedProjectId,
    setSelectedProjectId,
    sectionsById,
    milestonesById,
    loadProjects,
    createProject,
    updateProject,
  } = useProjectStore();

  const tasksById = useTaskStore((state) => state.tasksById);

  const [isMilestonesModalOpen, setIsMilestonesModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const projects = useMemo(
    () => Object.values(projectsById).sort((a, b) => a.sort_order - b.sort_order),
    [projectsById]
  );

  const currentProject = selectedProjectId ? projectsById[selectedProjectId] : null;

  const currentView: ProjectViewMode = currentProject?.default_view ?? 'list';

  const handleViewChange = async (view: ProjectViewMode) => {
    if (currentProject) {
      await updateProject(currentProject.id, { default_view: view });
    }
  };

  const projectSections = useMemo(() => {
    if (!currentProject) return [];
    return Object.values(sectionsById)
      .filter((s) => s.project_id === currentProject.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [sectionsById, currentProject]);

  const projectMilestones = useMemo(() => {
    if (!currentProject) return [];
    return Object.values(milestonesById)
      .filter((m) => m.project_id === currentProject.id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [milestonesById, currentProject]);

  const projectTasks = useMemo(() => {
    if (!currentProject) return [];
    return Object.values(tasksById).filter(
      (t) => t.project_id === currentProject.id && t.is_trashed === 0
    );
  }, [tasksById, currentProject]);

  const handleCreateNewProject = async () => {
    const name = window.prompt('Enter project name:', 'New Project');
    if (name && name.trim()) {
      await createProject({
        name: name.trim(),
        color: 'var(--tag-blue)',
        icon: '📁',
      });
    }
  };

  if (projects.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState
          icon="📁"
          title="No Projects Yet"
          description="Create structured multi-phase projects with sections, milestones, and 5 interactive views."
          action={
            <button
              type="button"
              className={styles.newProjectBtn}
              onClick={handleCreateNewProject}
            >
              + Create Project
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Project Switcher Bar */}
      <div className={styles.topBar}>
        <div className={styles.projectSelectorGroup}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Active Project:
          </span>
          <select
            className={styles.projectSelect}
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon || '📁'} {p.name} {p.status === 'archived' ? '(Archived)' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={styles.newProjectBtn}
          onClick={handleCreateNewProject}
          title="Create a new project"
        >
          <span>+</span>
          <span>New Project</span>
        </button>
      </div>

      {currentProject && (
        <>
          {/* Project Header Overview */}
          <ProjectHeader
            project={currentProject}
            sections={projectSections}
            tasks={projectTasks}
            milestones={projectMilestones}
            currentView={currentView}
            onViewChange={handleViewChange}
            onOpenMilestones={() => setIsMilestonesModalOpen(true)}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
          />

          {/* Crossfade Animated View Container (< 200ms per Phase 10 spec) */}
          <div className={styles.viewWrapper}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentProject.id}_${currentView}`}
                className={styles.animatedView}
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }} // Crossfade < 200ms (Site #6)
              >
                {currentView === 'list' && (
                  <ProjectListView
                    project={currentProject}
                    sections={projectSections}
                    tasks={projectTasks}
                    onSelectTask={(task) => setSelectedTask(task)}
                    selectedTaskId={selectedTask?.id}
                  />
                )}

                {currentView === 'board' && (
                  <ProjectBoardView
                    project={currentProject}
                    sections={projectSections}
                    tasks={projectTasks}
                    onSelectTask={(task) => setSelectedTask(task)}
                    selectedTaskId={selectedTask?.id}
                  />
                )}

                {currentView === 'timeline' && (
                  <ProjectTimelineView
                    project={currentProject}
                    tasks={projectTasks}
                    milestones={projectMilestones}
                    onSelectTask={(task) => setSelectedTask(task)}
                    selectedTaskId={selectedTask?.id}
                  />
                )}

                {currentView === 'calendar' && (
                  <ProjectCalendarView
                    project={currentProject}
                    tasks={projectTasks}
                    onSelectTask={(task) => setSelectedTask(task)}
                    selectedTaskId={selectedTask?.id}
                  />
                )}

                {currentView === 'table' && (
                  <ProjectTableView
                    project={currentProject}
                    sections={projectSections}
                    tasks={projectTasks}
                    onSelectTask={(task) => setSelectedTask(task)}
                    selectedTaskId={selectedTask?.id}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Milestones Modal */}
          {isMilestonesModalOpen && (
            <MilestonesModal
              projectId={currentProject.id}
              milestones={projectMilestones}
              onClose={() => setIsMilestonesModalOpen(false)}
            />
          )}

          {/* Templates Modal */}
          {isTemplateModalOpen && (
            <TemplateModal
              project={currentProject}
              sections={projectSections}
              tasks={projectTasks}
              onClose={() => setIsTemplateModalOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Projects;
