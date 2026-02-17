import { dataStore } from "$lib/stores/data.svelte.js";
import type {
  GitLabIssue,
  GitLabAssignee,
  TreeGroup,
  TreeProject,
  TreeEpic,
} from "$lib/types/gitlab.js";

// --- Filter state ---

let searchText = $state("");
let selectedLabels = $state<string[]>([]);
let statusFilter = $state<"all" | "opened" | "closed">("all");
let selectedAssignees = $state<string[]>([]);

// --- Sort state ---

export type SortField = "iid" | "title" | "status";

let sortField = $state<SortField>("iid");
let sortDirection = $state<"asc" | "desc">("asc");

// Whether the user has explicitly clicked a sort header
let sortActive = $state(false);

// --- Derived: available filter options from raw data ---

let allLabels = $derived.by(() => {
  const labels = new Set<string>();
  for (const issue of dataStore.issues) {
    for (const label of issue.labels) labels.add(label);
  }
  for (const epic of dataStore.epics) {
    for (const label of epic.labels) labels.add(label);
  }
  return [...labels].sort();
});

let allAssignees = $derived.by((): GitLabAssignee[] => {
  const map = new Map<string, GitLabAssignee>();
  for (const issue of dataStore.issues) {
    for (const a of issue.assignees) {
      if (!map.has(a.username)) map.set(a.username, a);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
});

// --- Derived: filtered + sorted tree ---

let filteredTree = $derived.by(() => applyFilters(dataStore.tree));

function applyFilters(tree: TreeGroup[]): TreeGroup[] {
  const noFilters =
    searchText === "" &&
    selectedLabels.length === 0 &&
    statusFilter === "all" &&
    selectedAssignees.length === 0;
  const defaultSort = sortField === "iid" && sortDirection === "asc";

  if (noFilters && defaultSort) return tree;

  return tree
    .map(filterGroup)
    .filter((g) => g.subgroups.length > 0 || g.projects.length > 0);
}

function filterGroup(tg: TreeGroup): TreeGroup {
  const subgroups = tg.subgroups
    .map(filterGroup)
    .filter((g) => g.subgroups.length > 0 || g.projects.length > 0);

  const projects = tg.projects
    .map(filterProject)
    .filter((p) => p.epics.length > 0);

  return { group: tg.group, subgroups, projects };
}

function filterProject(tp: TreeProject): TreeProject {
  const epics = tp.epics
    .map(filterEpic)
    .filter((e) => e.issues.length > 0);

  return { project: tp.project, epics };
}

function filterEpic(te: TreeEpic): TreeEpic {
  let issues = te.issues.filter(matchesFilters);
  issues = sortIssues(issues);
  return { epic: te.epic, issues };
}

function matchesFilters(issue: GitLabIssue): boolean {
  if (searchText) {
    const query = searchText.toLowerCase();
    if (!issue.title.toLowerCase().includes(query)) return false;
  }
  if (statusFilter !== "all" && issue.state !== statusFilter) return false;
  if (
    selectedLabels.length > 0 &&
    !selectedLabels.some((l) => issue.labels.includes(l))
  )
    return false;
  if (
    selectedAssignees.length > 0 &&
    !selectedAssignees.some((a) =>
      issue.assignees.some((ia) => ia.username === a),
    )
  )
    return false;
  return true;
}

function sortIssues(issues: GitLabIssue[]): GitLabIssue[] {
  if (sortField === "iid" && sortDirection === "asc") return issues;

  const sorted = [...issues];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "iid":
        cmp = a.iid - b.iid;
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "status":
        cmp = a.state.localeCompare(b.state);
        break;
    }
    return sortDirection === "desc" ? -cmp : cmp;
  });
  return sorted;
}

// --- Store export ---

export const filterStore = {
  get searchText() {
    return searchText;
  },
  set searchText(v: string) {
    searchText = v;
  },

  get selectedLabels() {
    return selectedLabels;
  },
  set selectedLabels(v: string[]) {
    selectedLabels = v;
  },

  get statusFilter() {
    return statusFilter;
  },
  set statusFilter(v: "all" | "opened" | "closed") {
    statusFilter = v;
  },

  get selectedAssignees() {
    return selectedAssignees;
  },
  set selectedAssignees(v: string[]) {
    selectedAssignees = v;
  },

  get sortField() {
    return sortField;
  },
  get sortDirection() {
    return sortDirection;
  },
  get sortActive() {
    return sortActive;
  },

  toggleSort(field: SortField) {
    sortActive = true;
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }
  },

  get allLabels() {
    return allLabels;
  },
  get allAssignees() {
    return allAssignees;
  },
  get filteredTree() {
    return filteredTree;
  },

  get hasActiveFilters() {
    return (
      searchText !== "" ||
      selectedLabels.length > 0 ||
      statusFilter !== "all" ||
      selectedAssignees.length > 0
    );
  },

  clearFilters() {
    searchText = "";
    selectedLabels = [];
    statusFilter = "all";
    selectedAssignees = [];
  },
};
