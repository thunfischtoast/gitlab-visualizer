export interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
  web_url: string;
  parent_id: number | null;
}

export interface GitLabProject {
  id: number;
  name: string;
  web_url: string;
  namespace: { id: number; full_path: string };
}

export interface GitLabEpic {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  group_id: number;
  labels: string[];
  state: string;
}

export interface GitLabAssignee {
  name: string;
  username: string;
  avatar_url: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  project_id: number;
  state: string;
  labels: string[];
  assignees: GitLabAssignee[];
  epic_iid: number | null;
  milestone: { title: string } | null;
}

// Tree structure for rendering the hierarchical table
// Note: expand/collapse state is NOT stored here — the tree is $derived
// (read-only). UI state like expanded nodes is tracked separately.

export interface TreeEpic {
  epic: GitLabEpic | null; // null = "No Epic" bucket
  issues: GitLabIssue[];
}

export interface TreeProject {
  project: GitLabProject;
  epics: TreeEpic[];
}

export interface TreeGroup {
  group: GitLabGroup;
  subgroups: TreeGroup[];
  projects: TreeProject[];
}

// Cached data stored in localStorage

export interface CachedData {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  epics: GitLabEpic[];
  issues: GitLabIssue[];
  timestamp: number;
}
