<script lang="ts">
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import MultiSelect from "./MultiSelect.svelte";
</script>

<div class="flex flex-wrap items-center gap-2">
  <Input
    type="text"
    placeholder="Search issues..."
    class="w-64"
    value={filterStore.searchText}
    oninput={(e: Event) => {
      filterStore.searchText = (e.currentTarget as HTMLInputElement).value;
    }}
  />

  <MultiSelect
    label="Labels"
    options={filterStore.allLabels.map((l) => ({ value: l, label: l }))}
    selected={filterStore.selectedLabels}
    onchange={(v) => {
      filterStore.selectedLabels = v;
    }}
  />

  <select
    class="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:border-ring"
    value={filterStore.statusFilter}
    onchange={(e) => {
      filterStore.statusFilter = (e.currentTarget as HTMLSelectElement)
        .value as "all" | "opened" | "closed";
    }}
  >
    <option value="all">All Status</option>
    <option value="opened">Open</option>
    <option value="closed">Closed</option>
  </select>

  <MultiSelect
    label="Assignees"
    options={filterStore.allAssignees.map((a) => ({
      value: a.username,
      label: a.name || a.username,
    }))}
    selected={filterStore.selectedAssignees}
    onchange={(v) => {
      filterStore.selectedAssignees = v;
    }}
  />

  {#if filterStore.hasActiveFilters}
    <button
      class="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent"
      onclick={() => filterStore.clearFilters()}
    >
      Clear filters
    </button>
  {/if}
</div>
