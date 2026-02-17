<script lang="ts">
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
  }: {
    onloaded: (data: LoadResult) => void;
    oncancel: () => void;
  } = $props();

  let phase = $state("Fetching groups...");
  let progress = $state(0);
  let total = $state(0);
  let error = $state("");
  let abortController: AbortController | null = null;

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

      // Phase 2: Fetch projects per group
      phase = "Fetching projects...";
      progress = 0;
      total = uniqueGroups.length;
      const allProjects: GitLabProject[] = [];
      const seenProjectIds = new Set<number>();

      for (const group of uniqueGroups) {
        if (signal.aborted) return;
        const projects = await fetchProjectsForGroup(config, group.id, signal);
        for (const p of projects) {
          if (!seenProjectIds.has(p.id)) {
            seenProjectIds.add(p.id);
            allProjects.push(p);
          }
        }
        progress++;
      }

      // Phase 3: Fetch epics per group
      phase = "Fetching epics...";
      progress = 0;
      total = uniqueGroups.length;
      const allEpics: GitLabEpic[] = [];

      for (const group of uniqueGroups) {
        if (signal.aborted) return;
        const epics = await fetchEpicsForGroup(config, group.id, signal);
        allEpics.push(...epics);
        progress++;
      }

      // Phase 4: Fetch issues per project
      phase = "Fetching issues...";
      progress = 0;
      total = allProjects.length;
      const allIssues: GitLabIssue[] = [];

      for (const project of allProjects) {
        if (signal.aborted) return;
        const issues = await fetchIssuesForProject(config, project.id, signal);
        allIssues.push(...issues);
        progress++;
      }

      onloaded({
        groups: uniqueGroups,
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

  // Start loading immediately
  $effect(() => {
    loadData();
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
