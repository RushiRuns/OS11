export interface ProjectTemplateTask {
  title: string;
  notes?: string | null;
  priority: number;
  estimated_minutes?: number | null;
}

export interface ProjectTemplateSection {
  name: string;
  tasks: ProjectTemplateTask[];
}

export interface ProjectTemplate {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sections: ProjectTemplateSection[];
}
