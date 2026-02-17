import { loadFromStorage, saveToStorage, removeFromStorage } from "$lib/utils/storage.js";
import { debugLog, debugWarn, debugError, checkDuplicateKeys } from "$lib/utils/debug.js";
import type {
  GitLabGroup,
  GitLabProject,
  GitLabEpic,
  GitLabIssue,
  TreeGroup,
  TreeProject,
  TreeEpic,
  CachedData,
} from "$lib/types/gitlab.js";

const STORAGE_KEY = "gitlab-data";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Raw data
let groups = $state<GitLabGroup[]>([]);
let projects = $state<GitLabProject[]>([]);
let epics = $state<GitLabEpic[]>([]);
let issues = $state<GitLabIssue[]>([]);
let cacheTimestamp = $state<number | null>(null);

// Built tree (derived from raw data)
let tree = $derived(buildTree(groups, projects, epics, issues));

function setData(data: {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  epics: GitLabEpic[];
  issues: GitLabIssue[];
}) {
  groups = data.groups;
  projects = data.projects;
  epics = data.epics;
  issues = data.issues;
  cacheTimestamp = Date.now();
  persist();
}

function clear() {
  groups = [];
  projects = [];
  epics = [];
  issues = [];
  cacheTimestamp = null;
  removeFromStorage(STORAGE_KEY);
}

/** Try loading from localStorage. Returns true if fresh cache was found. */
function loadFromCache(): boolean {
  const cached = loadFromStorage<CachedData | null>(STORAGE_KEY, null);
  if (!cached) return false;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_MAX_AGE_MS) {
    removeFromStorage(STORAGE_KEY);
    return false;
  }

  groups = cached.groups;
  projects = cached.projects;
  epics = cached.epics;
  issues = cached.issues;
  cacheTimestamp = cached.timestamp;
  return true;
}

function persist() {
  saveToStorage(STORAGE_KEY, {
    groups,
    projects,
    epics,
    issues,
    timestamp: cacheTimestamp!,
  } satisfies CachedData);
}

// --- Tree building ---

function buildTree(
  groups: GitLabGroup[],
  projects: GitLabProject[],
  epics: GitLabEpic[],
  issues: GitLabIssue[],
): TreeGroup[] {
  if (groups.length === 0) return [];

  debugLog("buildTree", `Input: ${groups.length} groups, ${projects.length} projects, ${epics.length} epics, ${issues.length} issues`);

  // --- Check raw data for duplicates ---
  checkDuplicateKeys("buildTree", "raw groups", groups, (g) => g.id);
  checkDuplicateKeys("buildTree", "raw projects", projects, (p) => p.id);
  checkDuplicateKeys("buildTree", "raw epics (by id)", epics, (e) => e.id);
  checkDuplicateKeys("buildTree", "raw epics (by group_id+iid)", epics, (e) => `${e.group_id}:${e.iid}`);
  checkDuplicateKeys("buildTree", "raw issues", issues, (i) => i.id);

  // Index issues by project_id
  const issuesByProject = new Map<number, GitLabIssue[]>();
  for (const issue of issues) {
    let list = issuesByProject.get(issue.project_id);
    if (!list) {
      list = [];
      issuesByProject.set(issue.project_id, list);
    }
    list.push(issue);
  }

  // Index epics by group_id
  const epicsByGroup = new Map<number, GitLabEpic[]>();
  for (const epic of epics) {
    let list = epicsByGroup.get(epic.group_id);
    if (!list) {
      list = [];
      epicsByGroup.set(epic.group_id, list);
    }
    list.push(epic);
  }

  // Log epicsByGroup for duplicate detection
  for (const [groupId, groupEpics] of epicsByGroup) {
    const dupes = checkDuplicateKeys("buildTree", `epicsByGroup[${groupId}]`, groupEpics, (e) => e.id);
    if (dupes.length > 0) {
      debugError("buildTree", `epicsByGroup[${groupId}] has duplicate epic IDs — this is the bug source!`, groupEpics);
    }
  }

  // Group lookup for ancestor traversal
  const groupMap = new Map<number, GitLabGroup>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  // Collect epics from a group and all its ancestors (issues can reference
  // epics from parent groups, not just the project's direct group)
  function collectEpicsForGroup(groupId: number): GitLabEpic[] {
    const result: GitLabEpic[] = [];
    let currentId: number | null = groupId;
    const visited: number[] = [];
    while (currentId !== null) {
      visited.push(currentId);
      const groupEpics = epicsByGroup.get(currentId);
      if (groupEpics) result.push(...groupEpics);
      const group = groupMap.get(currentId);
      currentId = group?.parent_id && groupMap.has(group.parent_id) ? group.parent_id : null;
    }
    const dupes = checkDuplicateKeys("buildTree", `collectEpicsForGroup(${groupId}) traversed=[${visited.join("->")}]`, result, (e) => e.id);
    if (dupes.length > 0) {
      debugError("buildTree", `collectEpicsForGroup(${groupId}) returned duplicate epics!`, result.map(e => ({ id: e.id, iid: e.iid, group_id: e.group_id, title: e.title })));
    }
    return result;
  }

  // Build TreeProject for each project
  function buildTreeProject(project: GitLabProject, availableEpics: GitLabEpic[]): TreeProject {
    const projectIssues = issuesByProject.get(project.id) ?? [];

    // Group issues by epic_iid
    const issuesByEpic = new Map<number | null, GitLabIssue[]>();
    for (const issue of projectIssues) {
      const key = issue.epic_iid;
      let list = issuesByEpic.get(key);
      if (!list) {
        list = [];
        issuesByEpic.set(key, list);
      }
      list.push(issue);
    }

    // Build TreeEpic for each epic that has issues in this project
    const treeEpics: TreeEpic[] = [];

    for (const epic of availableEpics) {
      const epicIssues = issuesByEpic.get(epic.iid);
      if (epicIssues && epicIssues.length > 0) {
        treeEpics.push({ epic, issues: epicIssues });
      }
    }

    // "No Epic" bucket for issues without an epic
    const noEpicIssues = issuesByEpic.get(null);
    if (noEpicIssues && noEpicIssues.length > 0) {
      treeEpics.push({ epic: null, issues: noEpicIssues });
    }

    // Check for duplicate epic keys in the built tree epics
    const epicDupes = checkDuplicateKeys(
      "buildTree",
      `treeEpics for project "${project.name}" (id=${project.id})`,
      treeEpics,
      (te) => te.epic?.id ?? `no-epic`,
    );
    if (epicDupes.length > 0) {
      debugError("buildTree", `PROJECT "${project.name}" (id=${project.id}) has DUPLICATE EPIC KEYS — this will cause Svelte each_key_duplicate!`, {
        epicDupes,
        treeEpics: treeEpics.map(te => ({
          epicId: te.epic?.id,
          epicIid: te.epic?.iid,
          epicGroupId: te.epic?.group_id,
          epicTitle: te.epic?.title,
          issueCount: te.issues.length,
        })),
        availableEpics: availableEpics.map(e => ({ id: e.id, iid: e.iid, group_id: e.group_id, title: e.title })),
        projectIssues: projectIssues.map(i => ({ id: i.id, iid: i.iid, epic_iid: i.epic_iid, title: i.title })),
      });
    }

    return { project, epics: treeEpics };
  }

  // Index projects by namespace group id
  const projectsByGroup = new Map<number, GitLabProject[]>();
  for (const project of projects) {
    const groupId = project.namespace.id;
    let list = projectsByGroup.get(groupId);
    if (!list) {
      list = [];
      projectsByGroup.set(groupId, list);
    }
    list.push(project);
  }

  function buildTreeGroup(group: GitLabGroup): TreeGroup {
    const groupProjects = projectsByGroup.get(group.id) ?? [];
    const availableEpics = collectEpicsForGroup(group.id);

    const treeProjects = groupProjects.map((p) => buildTreeProject(p, availableEpics));

    // Find direct child subgroups
    const subgroups = groups
      .filter((g) => g.parent_id === group.id)
      .map(buildTreeGroup);

    // Check for duplicate subgroup/project keys
    checkDuplicateKeys("buildTree", `subgroups of group "${group.name}" (id=${group.id})`, subgroups, (sg) => sg.group.id);
    checkDuplicateKeys("buildTree", `projects of group "${group.name}" (id=${group.id})`, treeProjects, (tp) => tp.project.id);

    return { group, subgroups, projects: treeProjects };
  }

  // Top-level groups (no parent, or parent not in our fetched set)
  const topLevelGroups = groups.filter(
    (g) => g.parent_id === null || !groupMap.has(g.parent_id),
  );

  debugLog("buildTree", `Top-level groups: ${topLevelGroups.length}`, topLevelGroups.map(g => ({ id: g.id, name: g.name })));

  const result = topLevelGroups.map(buildTreeGroup);

  // Final check on top-level tree
  checkDuplicateKeys("buildTree", "top-level tree groups", result, (tg) => tg.group.id);

  debugLog("buildTree", "Tree built successfully");
  return result;
}

export const dataStore = {
  get groups() { return groups; },
  get projects() { return projects; },
  get epics() { return epics; },
  get issues() { return issues; },
  get tree() { return tree; },
  get cacheTimestamp() { return cacheTimestamp; },
  get hasData() { return groups.length > 0; },
  setData,
  clear,
  loadFromCache,
};
