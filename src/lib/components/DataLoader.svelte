<script lang="ts">
  import { untrack } from "svelte";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import type { ClientConfig } from "$lib/api/gitlab-client.js";
  import {
    fetchAllGroups,
    fetchProjectsForGroup,
    fetchEpicsForGroup,
    fetchIssuesForProject,
  } from "$lib/api/gitlab-api.js";
  import type {
    GitLabGroup,
    GitLabProject,
    GitLabEpic,
    GitLabIssue,
  } from "$lib/types/gitlab.js";

  interface LoadResult {
    groups: GitLabGroup[];
    projects: GitLabProject[];
    epics: GitLabEpic[];
    issues: GitLabIssue[];
  }

  let {
    onloaded,
    oncancel,
    selectedGroupIds = [],
  }: {
    onloaded: (data: LoadResult) => void;
    oncancel: () => void;
    selectedGroupIds?: number[];
  } = $props();

  let phase = $state("Fetching groups...");
  let progress = $state(0);
  let total = $state(0);
  let error = $state("");
  let abortController: AbortController | null = null;

  /** BFS from selected top-level IDs through parent_id to find all descendant subgroups. */
  function filterGroupsBySelection(allGroups: GitLabGroup[], selectedIds: number[]): GitLabGroup[] {
    if (selectedIds.length === 0) return allGroups;

    // Build children map: parent_id → child groups
    const childrenMap = new Map<number, GitLabGroup[]>();
    for (const g of allGroups) {
      if (g.parent_id !== null) {
        let children = childrenMap.get(g.parent_id);
        if (!children) {
          children = [];
          childrenMap.set(g.parent_id, children);
        }
        children.push(g);
      }
    }

    // BFS from selected IDs
    const result: GitLabGroup[] = [];
    const visited = new Set<number>();
    const queue = allGroups.filter((g) => selectedIds.includes(g.id));

    for (const g of queue) {
      if (visited.has(g.id)) continue;
      visited.add(g.id);
      result.push(g);
      const children = childrenMap.get(g.id);
      if (children) {
        queue.push(...children);
      }
    }

    return result;
  }

  function getConfig(): ClientConfig {
    return {
      baseUrl: connectionStore.gitlabUrl,
      token: connectionStore.token,
      authMethod: connectionStore.authMethod,
    };
  }

  async function loadData() {
    abortController = new AbortController();
    const signal = abortController.signal;
    const config = getConfig();

    try {
      // Phase 1: Fetch groups
      phase = "Fetching groups...";
      progress = 0;
      total = 0;
      const groups = await fetchAllGroups(config, signal, (page) => {
        progress = page;
      });

      // Deduplicate groups by id (top_level_only=false may return nested groups)
      const uniqueGroups = [...new Map(groups.map((g) => [g.id, g])).values()];

      // Filter to selected groups + their descendants
      const groupsToLoad = filterGroupsBySelection(uniqueGroups, selectedGroupIds);

      // Phase 2: Fetch projects per group (parallel, throttled by concurrency limiter)
      phase = "Fetching projects...";
      progress = 0;
      total = groupsToLoad.length;
      const allProjects: GitLabProject[] = [];
      const seenProjectIds = new Set<number>();

      await Promise.all(groupsToLoad.map(async (group) => {
        const projects = await fetchProjectsForGroup(config, group.id, signal);
        for (const p of projects) {
          if (!seenProjectIds.has(p.id)) {
            seenProjectIds.add(p.id);
            allProjects.push(p);
          }
        }
        progress++;
      }));

      // Phase 3: Fetch epics per group (parallel, throttled by concurrency limiter)
      // Note: /groups/:id/epics returns epics from the group AND its descendants,
      // so fetching for every group produces duplicates. Deduplicate by epic id.
      phase = "Fetching epics...";
      progress = 0;
      total = groupsToLoad.length;
      const allEpics: GitLabEpic[] = [];
      const seenEpicIds = new Set<number>();

      await Promise.all(groupsToLoad.map(async (group) => {
        const epics = await fetchEpicsForGroup(config, group.id, signal);
        for (const e of epics) {
          if (!seenEpicIds.has(e.id)) {
            seenEpicIds.add(e.id);
            allEpics.push(e);
          }
        }
        progress++;
      }));

      // Phase 4: Fetch issues per project (parallel, throttled by concurrency limiter)
      phase = "Fetching issues...";
      progress = 0;
      total = allProjects.length;
      const allIssues: GitLabIssue[] = [];

      await Promise.all(allProjects.map(async (project) => {
        const issues = await fetchIssuesForProject(config, project.id, signal);
        allIssues.push(...issues);
        progress++;
      }));

      onloaded({
        groups: groupsToLoad,
        projects: allProjects,
        epics: allEpics,
        issues: allIssues,
      });
    } catch (err) {
      if (signal.aborted) return;
      error = err instanceof Error ? err.message : "Failed to load data";
    }
  }

  function cancel() {
    abortController?.abort();
    oncancel();
  }

  function retry() {
    error = "";
    loadData();
  }

  // Start loading once on mount — untrack to avoid re-firing on reactive changes
  $effect(() => {
    untrack(() => loadData());
    return () => abortController?.abort();
  });
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <Card class="w-full max-w-md">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">Loading Data</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
        <div class="flex gap-2">
          <Button variant="outline" class="flex-1" onclick={cancel}>Cancel</Button>
          <Button class="flex-1" onclick={retry}>Retry</Button>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">{phase}</p>
        {#if total > 0}
          <Progress value={progress} max={total} />
          <p class="text-xs text-muted-foreground text-center">{progress} / {total}</p>
        {:else}
          <Progress value={undefined} />
        {/if}
        <Button variant="outline" class="w-full" onclick={cancel}>Cancel</Button>
      {/if}
    </CardContent>
  </Card>
</div>
