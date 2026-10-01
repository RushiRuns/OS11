export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  listId?: string | null;
  areaId?: string | null;
  projectId?: string | null;
}
