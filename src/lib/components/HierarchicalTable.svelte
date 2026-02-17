<script lang="ts">
  import { dataStore } from "$lib/stores/data.svelte.js";
  import { collectAllKeys } from "$lib/utils/tree.js";
  import GroupRow from "./GroupRow.svelte";

  let expandedKeys = $state(new Set<string>());

  function toggle(key: string) {
    if (expandedKeys.has(key)) {
      expandedKeys.delete(key);
    } else {
      expandedKeys.add(key);
    }
  }

  function expandAll() {
    const allKeys = new Set<string>();
    for (const treeGroup of dataStore.tree) {
      for (const key of collectAllKeys(treeGroup)) {
        allKeys.add(key);
      }
    }
    expandedKeys = allKeys;
  }

  function collapseAll() {
    expandedKeys = new Set();
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
  <div class="flex items-center border-b-2 border-border py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    <div class="min-w-0 flex-1">Name</div>
    <div class="w-48 flex-shrink-0 px-2">Labels</div>
    <div class="w-20 flex-shrink-0 text-center">Status</div>
    <div class="w-32 flex-shrink-0 px-2">Assignee</div>
    <div class="w-16 flex-shrink-0 text-center">Count</div>
  </div>

  <!-- Rows -->
  {#each dataStore.tree as treeGroup (treeGroup.group.id)}
    <GroupRow
      {treeGroup}
      depth={0}
      {expandedKeys}
      ontoggle={toggle}
    />
  {/each}

  {#if dataStore.tree.length === 0}
    <div class="py-8 text-center text-sm text-muted-foreground">
      No data to display.
    </div>
  {/if}
</div>
