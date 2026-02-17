<script lang="ts">
  import { filterStore, type SortField } from "$lib/stores/filters.svelte.js";
  import { collectAllKeys } from "$lib/utils/tree.js";
  import GroupRow from "./GroupRow.svelte";

  let expandedKeys = $state(new Set<string>());

  function toggle(key: string) {
    const next = new Set(expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedKeys = next;
  }

  function expandAll() {
    const allKeys = new Set<string>();
    for (const treeGroup of filterStore.filteredTree) {
      for (const key of collectAllKeys(treeGroup)) {
        allKeys.add(key);
      }
    }
    expandedKeys = allKeys;
  }

  function collapseAll() {
    expandedKeys = new Set();
  }

  function sortIndicator(field: SortField): string {
    if (!filterStore.sortActive || filterStore.sortField !== field) return "";
    return filterStore.sortDirection === "asc" ? " \u25B4" : " \u25BE";
  }
</script>

<div>
  <!-- Toolbar -->
  <div class="mb-2 flex gap-2">
    <button
      class="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
      onclick={expandAll}
    >
      Expand All
    </button>
    <button
      class="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
      onclick={collapseAll}
    >
      Collapse All
    </button>
  </div>

  <!-- Column headers -->
  <div
    class="flex items-center border-b-2 border-border py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
  >
    <button
      class="min-w-0 flex-1 text-left hover:text-foreground"
      onclick={() => filterStore.toggleSort("title")}
    >
      Name{sortIndicator("title")}
    </button>
    <div class="w-48 flex-shrink-0 px-2">Labels</div>
    <button
      class="w-20 flex-shrink-0 text-center hover:text-foreground"
      onclick={() => filterStore.toggleSort("status")}
    >
      Status{sortIndicator("status")}
    </button>
    <div class="w-32 flex-shrink-0 px-2">Assignee</div>
    <button
      class="w-16 flex-shrink-0 text-center hover:text-foreground"
      onclick={() => filterStore.toggleSort("iid")}
    >
      Count{sortIndicator("iid")}
    </button>
  </div>

  <!-- Rows -->
  {#each filterStore.filteredTree as treeGroup (treeGroup.group.id)}
    <GroupRow {treeGroup} depth={0} {expandedKeys} ontoggle={toggle} />
  {/each}

  {#if filterStore.filteredTree.length === 0}
    <div class="py-8 text-center text-sm text-muted-foreground">
      {#if filterStore.hasActiveFilters}
        No issues match your filters.
      {:else}
        No data to display.
      {/if}
    </div>
  {/if}
</div>
