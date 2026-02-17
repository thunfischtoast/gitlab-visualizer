import type { TreeGroup } from "$lib/types/gitlab.js";

/** Recursively count all issues in a tree group (including subgroups). */
export function countIssues(treeGroup: TreeGroup): number {
  let count = 0;
  for (const project of treeGroup.projects) {
    for (const epic of project.epics) {
      count += epic.issues.length;
    }
  }
  for (const subgroup of treeGroup.subgroups) {
    count += countIssues(subgroup);
  }
  return count;
}

/** Collect all expandable keys from a tree group (for Expand All). */
export function collectAllKeys(treeGroup: TreeGroup): string[] {
  const keys: string[] = [`group-${treeGroup.group.id}`];
  for (const subgroup of treeGroup.subgroups) {
    keys.push(...collectAllKeys(subgroup));
  }
  for (const project of treeGroup.projects) {
    keys.push(`project-${project.project.id}`);
    for (const treeEpic of project.epics) {
      if (treeEpic.epic) {
        keys.push(`epic-${treeEpic.epic.group_id}-${treeEpic.epic.iid}`);
      } else {
        keys.push(`no-epic-${project.project.id}`);
      }
    }
  }
  return keys;
}
