<script lang="ts">
  import { filterStore, type SortField } from "$lib/stores/filters.svelte.js";
  import { collectAllKeys } from "$lib/utils/tree.js";
  import { checkDuplicateKeys } from "$lib/utils/debug.js";
  import GroupRow from "./GroupRow.svelte";
  import MultiSelect from "./MultiSelect.svelte";

  let expandedKeys = $state(new Set<string>());

  // Debug: check for duplicate keys whenever filteredTree changes
  $effect(() => {
    checkDuplicateKeys("HierarchicalTable", "filteredTree group keys", filterStore.filteredTree, (tg) => tg.group.id);
  });

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
  <div class="mb-2 flex items-center gap-2">
    <button
      class="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={expandAll}
    >
      Expand All
    </button>
    <button
      class="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={collapseAll}
    >
      Collapse All
    </button>
    {#if filterStore.scopedLabelKeys.length > 0}
      <div class="ml-auto hidden lg:block">
        <MultiSelect
          label="Columns"
          options={filterStore.scopedLabelKeys.map((k) => ({
            value: k,
            label: k,
          }))}
          selected={filterStore.enabledScopedKeys}
          onchange={(v) => {
            filterStore.enabledScopedKeys = v;
          }}
        />
      </div>
    {/if}
  </div>

  <!-- Column headers -->
  <div
    class="flex items-center border-b-2 border-border py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
  >
    <button
      class="min-w-0 flex-1 text-left transition-colors hover:text-foreground"
      onclick={() => filterStore.toggleSort("title")}
    >
      Name{sortIndicator("title")}
    </button>
    <div class="hidden w-48 flex-shrink-0 px-2 lg:block">Labels</div>
    {#each filterStore.activeScopedKeys as key}
      <div class="hidden w-28 flex-shrink-0 px-2 lg:block">{key}</div>
    {/each}
    <button
      class="w-20 flex-shrink-0 text-center transition-colors hover:text-foreground"
      onclick={() => filterStore.toggleSort("status")}
    >
      Status{sortIndicator("status")}
    </button>
    <div class="hidden w-32 flex-shrink-0 px-2 md:block">Assignee</div>
    <button
      class="w-16 flex-shrink-0 text-center transition-colors hover:text-foreground"
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
    <div class="py-12 text-center">
      {#if filterStore.hasActiveFilters}
        <p class="text-sm text-muted-foreground">No issues match your filters.</p>
        <button
          class="mt-2 text-sm text-primary underline-offset-4 transition-colors hover:underline"
          onclick={() => filterStore.clearFilters()}
        >
          Clear all filters
        </button>
      {:else}
        <p class="text-sm text-muted-foreground">No data to display.</p>
      {/if}
    </div>
  {/if}
</div>
