import { dataStore } from "$lib/stores/data.svelte.js";
import type {
  GitLabEpic,
  GitLabIssue,
  GitLabAssignee,
  TreeGroup,
  TreeProject,
  TreeEpic,
} from "$lib/types/gitlab.js";

// --- Helpers ---

function parseScopedLabel(label: string): { key: string; value: string } | null {
  const idx = label.indexOf("::");
  if (idx === -1) return null;
  return { key: label.substring(0, idx), value: label.substring(idx + 2) };
}

// --- Search snippet extraction ---

export type SearchSnippet = { before: string; match: string; after: string };

function extractSnippet(
  text: string,
  query: string,
  contextChars = 60,
): SearchSnippet | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(
    normalized.length,
    idx + query.length + contextChars,
  );

  return {
    before: (start > 0 ? "\u2026" : "") + normalized.substring(start, idx),
    match: normalized.substring(idx, idx + query.length),
    after:
      normalized.substring(idx + query.length, end) +
      (end < normalized.length ? "\u2026" : ""),
  };
}

// --- Scoped column state ---

const DEFAULT_SCOPED_KEYS = ["Partner", "Priority", "State", "Type"];
let enabledScopedKeys = $state<string[]>(DEFAULT_SCOPED_KEYS);

// --- Filter state (grouped into a single object) ---

interface FilterState {
  searchText: string;
  selectedLabels: string[];
  statusFilter: "all" | "opened" | "closed";
  selectedAssignees: string[];
  selectedScopedLabels: Record<string, string[]>;
}

const DEFAULT_FILTERS: FilterState = {
  searchText: "",
  selectedLabels: [],
  statusFilter: "opened",
  selectedAssignees: [],
  selectedScopedLabels: {},
};

let filters = $state<FilterState>({ ...DEFAULT_FILTERS });

// --- Sort state ---

export type SortField = "iid" | "title" | "status";

let sortField = $state<SortField>("iid");
let sortDirection = $state<"asc" | "desc">("asc");

// Whether the user has explicitly clicked a sort header
let sortActive = $state(false);

// --- Derived: available filter options from raw data ---

function isActiveScopedLabel(label: string): boolean {
  const parsed = parseScopedLabel(label);
  return parsed !== null && activeScopedKeys.includes(parsed.key);
}

let allLabels = $derived.by(() => {
  const labels = new Set<string>();
  for (const issue of dataStore.issues) {
    for (const label of issue.labels) {
      if (!isActiveScopedLabel(label)) labels.add(label);
    }
  }
  for (const epic of dataStore.epics) {
    for (const label of epic.labels) {
      if (!isActiveScopedLabel(label)) labels.add(label);
    }
  }
  return [...labels].sort();
});

let scopedLabelKeys = $derived.by(() => {
  const keys = new Set<string>();
  for (const issue of dataStore.issues) {
    for (const label of issue.labels) {
      const parsed = parseScopedLabel(label);
      if (parsed) keys.add(parsed.key);
    }
  }
  for (const epic of dataStore.epics) {
    for (const label of epic.labels) {
      const parsed = parseScopedLabel(label);
      if (parsed) keys.add(parsed.key);
    }
  }
  return [...keys].sort();
});

// Only keys the user has enabled AND that exist in the data
let activeScopedKeys = $derived(
  enabledScopedKeys.filter((k) => scopedLabelKeys.includes(k)),
);

let scopedLabelValues = $derived.by(() => {
  const map: Record<string, Set<string>> = {};
  for (const issue of dataStore.issues) {
    for (const label of issue.labels) {
      const parsed = parseScopedLabel(label);
      if (parsed) {
        (map[parsed.key] ??= new Set()).add(parsed.value);
      }
    }
  }
  for (const epic of dataStore.epics) {
    for (const label of epic.labels) {
      const parsed = parseScopedLabel(label);
      if (parsed) {
        (map[parsed.key] ??= new Set()).add(parsed.value);
      }
    }
  }
  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(map)) {
    result[key] = [...values].sort();
  }
  return result;
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
  const hasScopedFilters = Object.values(filters.selectedScopedLabels).some(
    (v) => v.length > 0,
  );
  const noFilters =
    filters.searchText === "" &&
    filters.selectedLabels.length === 0 &&
    filters.statusFilter === "all" &&
    filters.selectedAssignees.length === 0 &&
    !hasScopedFilters;
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
    .filter((e) => e.issues.length > 0 || epicMatchesSearch(e.epic));

  return { project: tp.project, epics };
}

function epicMatchesSearch(epic: GitLabEpic | null): boolean {
  if (!epic || !filters.searchText) return false;
  const query = filters.searchText.toLowerCase();
  return (
    epic.title.toLowerCase().includes(query) ||
    (epic.description?.toLowerCase().includes(query) ?? false)
  );
}

function filterEpic(te: TreeEpic): TreeEpic {
  let issues = te.issues.filter(matchesFilters);
  issues = sortIssues(issues);

  // When searching, partition: title matches first, then description-only
  if (filters.searchText) {
    const query = filters.searchText.toLowerCase();
    const titleMatches = issues.filter((i) =>
      i.title.toLowerCase().includes(query),
    );
    const descOnly = issues.filter(
      (i) => !i.title.toLowerCase().includes(query),
    );
    issues = [...titleMatches, ...descOnly];
  }

  return { epic: te.epic, issues };
}

function matchesFilters(issue: GitLabIssue): boolean {
  if (filters.searchText) {
    const query = filters.searchText.toLowerCase();
    const titleMatch = issue.title.toLowerCase().includes(query);
    const descMatch =
      issue.description?.toLowerCase().includes(query) ?? false;
    if (!titleMatch && !descMatch) return false;
  }
  if (filters.statusFilter !== "all" && issue.state !== filters.statusFilter) return false;
  if (
    filters.selectedLabels.length > 0 &&
    !filters.selectedLabels.some((l) => issue.labels.includes(l))
  )
    return false;
  if (
    filters.selectedAssignees.length > 0 &&
    !filters.selectedAssignees.some((a) =>
      issue.assignees.some((ia) => ia.username === a),
    )
  )
    return false;
  // Scoped labels: OR within a key, AND across keys
  for (const [key, values] of Object.entries(filters.selectedScopedLabels)) {
    if (values.length === 0) continue;
    const hasMatch = values.some((v) =>
      issue.labels.includes(`${key}::${v}`),
    );
    if (!hasMatch) return false;
  }
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
  get searchText() { return filters.searchText; },
  set searchText(v: string) { filters.searchText = v; },

  get selectedLabels() { return filters.selectedLabels; },
  set selectedLabels(v: string[]) { filters.selectedLabels = v; },

  get statusFilter() { return filters.statusFilter; },
  set statusFilter(v: "all" | "opened" | "closed") { filters.statusFilter = v; },

  get selectedAssignees() { return filters.selectedAssignees; },
  set selectedAssignees(v: string[]) { filters.selectedAssignees = v; },

  get selectedScopedLabels() { return filters.selectedScopedLabels; },
  setScopedLabelFilter(key: string, values: string[]) {
    filters.selectedScopedLabels = { ...filters.selectedScopedLabels, [key]: values };
  },

  get sortField() { return sortField; },
  get sortDirection() { return sortDirection; },
  get sortActive() { return sortActive; },

  toggleSort(field: SortField) {
    sortActive = true;
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }
  },

  get allLabels() { return allLabels; },
  get allAssignees() { return allAssignees; },
  get filteredTree() { return filteredTree; },

  get scopedLabelKeys() { return scopedLabelKeys; },
  get activeScopedKeys() { return activeScopedKeys; },
  get enabledScopedKeys() { return enabledScopedKeys; },
  set enabledScopedKeys(v: string[]) { enabledScopedKeys = v; },
  get scopedLabelValues() { return scopedLabelValues; },

  getIssueSearchSnippet(issue: GitLabIssue): SearchSnippet | null {
    if (!filters.searchText) return null;
    const query = filters.searchText.toLowerCase();
    if (issue.title.toLowerCase().includes(query)) return null;
    if (!issue.description) return null;
    return extractSnippet(issue.description, filters.searchText);
  },

  getEpicSearchSnippet(epic: GitLabEpic): SearchSnippet | null {
    if (!filters.searchText) return null;
    const query = filters.searchText.toLowerCase();
    if (epic.title.toLowerCase().includes(query)) return null;
    if (!epic.description) return null;
    return extractSnippet(epic.description, filters.searchText);
  },

  get hasActiveFilters() {
    return (
      filters.searchText !== "" ||
      filters.selectedLabels.length > 0 ||
      filters.statusFilter !== "opened" ||
      filters.selectedAssignees.length > 0 ||
      Object.values(filters.selectedScopedLabels).some((v) => v.length > 0)
    );
  },

  clearFilters() {
    filters = { ...DEFAULT_FILTERS, selectedScopedLabels: {} };
  },
};
