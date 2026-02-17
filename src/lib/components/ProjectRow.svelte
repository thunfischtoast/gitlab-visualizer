<script lang="ts">
  import { slide } from "svelte/transition";
  import type { TreeProject } from "$lib/types/gitlab.js";
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import EpicRow from "./EpicRow.svelte";
  import { checkDuplicateKeys, debugError } from "$lib/utils/debug.js";

  interface Props {
    treeProject: TreeProject;
    depth: number;
    expandedKeys: Set<string>;
    ontoggle: (key: string) => void;
  }

  let { treeProject, depth, expandedKeys, ontoggle }: Props = $props();

  let projectKey = $derived(`project-${treeProject.project.id}`);
  let expanded = $derived(expandedKeys.has(projectKey));
  let issueCount = $derived(
    treeProject.epics.reduce((sum, e) => sum + e.issues.length, 0)
  );

  // Debug: check for duplicate epic keys — this is the most likely location for the each_key_duplicate bug
  $effect(() => {
    const dupes = checkDuplicateKeys(
      "ProjectRow",
      `epics in project "${treeProject.project.name}" (id=${treeProject.project.id})`,
      treeProject.epics,
      (te) => te.epic?.id ?? `no-epic-${treeProject.project.id}`,
    );
    if (dupes.length > 0) {
      debugError("ProjectRow", `FOUND THE BUG! Project "${treeProject.project.name}" has duplicate epic keys:`, {
        dupes,
        epics: treeProject.epics.map(te => ({
          epicId: te.epic?.id,
          epicIid: te.epic?.iid,
          epicGroupId: te.epic?.group_id,
          epicTitle: te.epic?.title ?? "(No Epic)",
          issueCount: te.issues.length,
          issueIds: te.issues.map(i => i.id),
        })),
      });
    }
  });
</script>

<div
  class="flex cursor-pointer items-center border-b border-border py-1.5 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  style="padding-left: {depth * 1.5}rem;"
  onclick={() => ontoggle(projectKey)}
  onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ontoggle(projectKey); } }}
  role="button"
  tabindex="0"
>
  <!-- Name column -->
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="inline-block w-4 flex-shrink-0 text-center text-muted-foreground">
      {expanded ? "\u25BE" : "\u25B8"}
    </span>
    <span class="truncate">{treeProject.project.name}</span>
  </div>

  <!-- Labels column -->
  <div class="hidden w-48 flex-shrink-0 px-2 lg:block"></div>

  <!-- Scoped label columns (spacers) -->
  {#each filterStore.scopedLabelKeys as key}
    <div class="hidden w-28 flex-shrink-0 px-2 lg:block"></div>
  {/each}

  <!-- Status column -->
  <div class="w-20 flex-shrink-0"></div>

  <!-- Assignee column -->
  <div class="hidden w-32 flex-shrink-0 px-2 md:block"></div>

  <!-- Count column -->
  <div class="w-16 flex-shrink-0 text-center text-xs text-muted-foreground">
    {issueCount}
  </div>
</div>

{#if expanded}
  <div out:slide={{ duration: 150 }}>
    {#each treeProject.epics as treeEpic (treeEpic.epic?.id ?? `no-epic-${treeProject.project.id}`)}
      {@const epicKey = treeEpic.epic
        ? `epic-${treeEpic.epic.group_id}-${treeEpic.epic.iid}`
        : `no-epic-${treeProject.project.id}`}
      <EpicRow
        {treeEpic}
        depth={depth + 1}
        expanded={expandedKeys.has(epicKey)}
        ontoggle={() => ontoggle(epicKey)}
      />
    {/each}
  </div>
{/if}
