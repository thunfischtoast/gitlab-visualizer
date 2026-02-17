import { loadFromStorage, saveToStorage, removeFromStorage } from "$lib/utils/storage.js";
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
  if (age > CACHE_MAX_AGE_MS) return false;

  groups = cached.groups;
  projects = cached.projects;
  epics = cached.epics;
  issues = cached.issues;
  cacheTimestamp = cached.timestamp;
  return true;
}

function persist() {
  const data: CachedData = {
    groups,
    projects,
    epics,
    issues,
    timestamp: cacheTimestamp ?? Date.now(),
  };
  saveToStorage(STORAGE_KEY, data);
}

// --- Tree building ---

function buildTree(
  groups: GitLabGroup[],
  projects: GitLabProject[],
  epics: GitLabEpic[],
  issues: GitLabIssue[],
): TreeGroup[] {
  if (groups.length === 0) return [];

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

  // Build TreeProject for each project
  function buildTreeProject(project: GitLabProject, groupEpics: GitLabEpic[]): TreeProject {
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

    for (const epic of groupEpics) {
      const epicIssues = issuesByEpic.get(epic.iid);
      if (epicIssues && epicIssues.length > 0) {
        treeEpics.push({ epic, issues: epicIssues, expanded: false });
      }
    }

    // "No Epic" bucket for issues without an epic
    const noEpicIssues = issuesByEpic.get(null);
    if (noEpicIssues && noEpicIssues.length > 0) {
      treeEpics.push({ epic: null, issues: noEpicIssues, expanded: false });
    }

    return { project, epics: treeEpics, expanded: false };
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

  // Build group tree with subgroups
  const groupMap = new Map<number, GitLabGroup>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  function buildTreeGroup(group: GitLabGroup): TreeGroup {
    const groupProjects = projectsByGroup.get(group.id) ?? [];
    const groupEpics = epicsByGroup.get(group.id) ?? [];

    const treeProjects = groupProjects.map((p) => buildTreeProject(p, groupEpics));

    // Find direct child subgroups
    const subgroups = groups
      .filter((g) => g.parent_id === group.id)
      .map(buildTreeGroup);

    return {
      group,
      subgroups,
      projects: treeProjects,
      expanded: false,
    };
  }

  // Top-level groups (no parent, or parent not in our fetched set)
  const topLevelGroups = groups.filter(
    (g) => g.parent_id === null || !groupMap.has(g.parent_id),
  );

  return topLevelGroups.map(buildTreeGroup);
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
