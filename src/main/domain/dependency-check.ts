export interface DependencyEdge {
  task_id: string;
  depends_on_task_id: string;
}

export function wouldCreateCycle(
  taskId: string,
  dependsOnId: string,
  getAllDependencies: () => DependencyEdge[]
): boolean {
  if (taskId === dependsOnId) {
    return true;
  }

  const existingEdges = getAllDependencies();

  // Adjacency map: node -> dependencies it relies upon
  const adj = new Map<string, string[]>();
  for (const edge of existingEdges) {
    const list = adj.get(edge.task_id) ?? [];
    list.push(edge.depends_on_task_id);
    adj.set(edge.task_id, list);
  }

  // BFS search starting from dependsOnId to see if taskId can be reached
  const visited = new Set<string>();
  const queue: string[] = [dependsOnId];
  visited.add(dependsOnId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) {
      return true;
    }

    const neighbors = adj.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}
