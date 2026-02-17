<script lang="ts">
  import { untrack } from "svelte";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import { groupSelectionStore } from "$lib/stores/groupSelection.svelte.js";
  import { fetchAllGroups } from "$lib/api/gitlab-api.js";
  import type { ClientConfig } from "$lib/api/gitlab-client.js";
  import type { GitLabGroup } from "$lib/types/gitlab.js";

  let {
    onconfirm,
    oncancel,
  }: {
    onconfirm: (selectedIds: number[]) => void;
    oncancel: () => void;
  } = $props();

  let groups = $state<GitLabGroup[]>([]);
  let loading = $state(true);
  let error = $state("");
  let search = $state("");
  let selected = $state<Set<number>>(new Set());

  // Filter to top-level groups, sorted by full_path
  const topLevelGroups = $derived(
    groups
      .filter((g) => g.parent_id === null)
      .sort((a, b) => a.full_path.localeCompare(b.full_path))
  );

  const filteredGroups = $derived(
    search.trim()
      ? topLevelGroups.filter((g) =>
          g.full_path.toLowerCase().includes(search.trim().toLowerCase())
        )
      : topLevelGroups
  );

  const selectedCount = $derived(selected.size);

  function getConfig(): ClientConfig {
    return {
      baseUrl: connectionStore.gitlabUrl,
      token: connectionStore.token,
      authMethod: connectionStore.authMethod,
    };
  }

  async function loadGroups() {
    loading = true;
    error = "";
    try {
      const allGroups = await fetchAllGroups(getConfig());
      groups = [...new Map(allGroups.map((g) => [g.id, g])).values()];

      // Pre-populate selection from store, or select all on first visit
      const storedIds = groupSelectionStore.selectedIds;
      const topLevel = groups.filter((g) => g.parent_id === null);
      if (storedIds.length > 0) {
        const topLevelIdSet = new Set(topLevel.map((g) => g.id));
        selected = new Set(storedIds.filter((id) => topLevelIdSet.has(id)));
        // If all stored IDs were removed (groups no longer exist), select all
        if (selected.size === 0) {
          selected = new Set(topLevel.map((g) => g.id));
        }
      } else {
        selected = new Set(topLevel.map((g) => g.id));
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch groups";
    } finally {
      loading = false;
    }
  }

  function toggleGroup(id: number) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selected = next;
  }

  function selectAll() {
    selected = new Set(topLevelGroups.map((g) => g.id));
  }

  function deselectAll() {
    selected = new Set();
  }

  function confirm() {
    const ids = [...selected];
    groupSelectionStore.setSelection(ids);
    onconfirm(ids);
  }

  $effect(() => {
    untrack(() => loadGroups());
  });
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <Card class="w-full max-w-md">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">Select Groups</CardTitle>
      <CardDescription>Choose which top-level groups to load</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-muted-foreground">Fetching groups...</p>
        <Button variant="outline" class="w-full" onclick={oncancel}>Cancel</Button>
      {:else if error}
        <p class="text-sm text-destructive">{error}</p>
        <div class="flex gap-2">
          <Button variant="outline" class="flex-1" onclick={oncancel}>Cancel</Button>
          <Button class="flex-1" onclick={loadGroups}>Retry</Button>
        </div>
      {:else}
        <Input
          type="text"
          placeholder="Search groups..."
          bind:value={search}
        />

        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>{topLevelGroups.length} groups found</span>
          <span class="flex gap-2">
            <button class="underline underline-offset-2 hover:text-foreground" onclick={selectAll}>Select All</button>
            <button class="underline underline-offset-2 hover:text-foreground" onclick={deselectAll}>Deselect All</button>
          </span>
        </div>

        <div class="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {#each filteredGroups as group (group.id)}
            <label
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.has(group.id)}
                onchange={() => toggleGroup(group.id)}
                class="h-4 w-4 rounded border-border accent-primary"
              />
              <span class="truncate">{group.full_path}</span>
            </label>
          {/each}
          {#if filteredGroups.length === 0}
            <p class="py-2 text-center text-sm text-muted-foreground">No groups match your search</p>
          {/if}
        </div>

        <div class="flex gap-2">
          <Button variant="outline" class="flex-1" onclick={oncancel}>Cancel</Button>
          <Button class="flex-1" onclick={confirm} disabled={selectedCount === 0}>
            Load {selectedCount} {selectedCount === 1 ? "group" : "groups"}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
