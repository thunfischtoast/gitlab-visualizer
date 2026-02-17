import type { ClientConfig } from "./gitlab-client.js";
import { apiFetch, apiFetchAllPages, GitLabApiError } from "./gitlab-client.js";
import type {
  GitLabGroup,
  GitLabProject,
  GitLabEpic,
  GitLabIssue,
} from "$lib/types/gitlab.js";

/** Validate the connection by fetching the current user. Returns the username. */
export async function validateConnection(
  config: ClientConfig,
): Promise<string> {
  const user = await apiFetch<{ username: string }>(config, "/user");
  return user.username;
}

/** Fetch all groups accessible to the user. */
export async function fetchAllGroups(
  config: ClientConfig,
  signal?: AbortSignal,
  onPage?: (page: number) => void,
): Promise<GitLabGroup[]> {
  return apiFetchAllPages<GitLabGroup>(
    config,
    "/groups?top_level_only=false",
    signal,
    onPage,
  );
}

/** Fetch all projects for a group (including subgroups). */
export async function fetchProjectsForGroup(
  config: ClientConfig,
  groupId: number,
  signal?: AbortSignal,
): Promise<GitLabProject[]> {
  return apiFetchAllPages<GitLabProject>(
    config,
    `/groups/${groupId}/projects?include_subgroups=true`,
    signal,
  );
}

/** Fetch epics for a group. Returns empty array if epics are unavailable (403). */
export async function fetchEpicsForGroup(
  config: ClientConfig,
  groupId: number,
  signal?: AbortSignal,
): Promise<GitLabEpic[]> {
  try {
    return await apiFetchAllPages<GitLabEpic>(
      config,
      `/groups/${groupId}/epics`,
      signal,
    );
  } catch (err) {
    if (err instanceof GitLabApiError && err.status === 403) {
      // Epics require GitLab Premium — skip gracefully
      return [];
    }
    throw err;
  }
}

/** Fetch all issues for a project. */
export async function fetchIssuesForProject(
  config: ClientConfig,
  projectId: number,
  signal?: AbortSignal,
): Promise<GitLabIssue[]> {
  return apiFetchAllPages<GitLabIssue>(
    config,
    `/projects/${projectId}/issues`,
    signal,
  );
}
