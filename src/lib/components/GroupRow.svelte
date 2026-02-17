<script lang="ts">
  import type { TreeGroup } from "$lib/types/gitlab.js";
  import GroupRow from "./GroupRow.svelte";
  import ProjectRow from "./ProjectRow.svelte";
  import { countIssues } from "$lib/utils/tree.js";

  interface Props {
    treeGroup: TreeGroup;
    depth: number;
    expandedKeys: Set<string>;
    ontoggle: (key: string) => void;
  }

  let { treeGroup, depth, expandedKeys, ontoggle }: Props = $props();

  let groupKey = $derived(`group-${treeGroup.group.id}`);
  let expanded = $derived(expandedKeys.has(groupKey));
  let issueCount = $derived(countIssues(treeGroup));
</script>

<div
  class="flex cursor-pointer items-center border-b border-border py-1.5 text-sm font-semibold hover:bg-accent/50"
  style="padding-left: {depth * 1.5}rem;"
  onclick={() => ontoggle(groupKey)}
  onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") ontoggle(groupKey); }}
  role="button"
  tabindex="0"
>
  <!-- Name column -->
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="inline-block w-4 flex-shrink-0 text-center text-muted-foreground">
      {expanded ? "\u25BE" : "\u25B8"}
    </span>
    <span class="truncate">{treeGroup.group.name}</span>
  </div>

  <!-- Labels column -->
  <div class="w-48 flex-shrink-0 px-2"></div>

  <!-- Status column -->
  <div class="w-20 flex-shrink-0"></div>

  <!-- Assignee column -->
  <div class="w-32 flex-shrink-0 px-2"></div>

  <!-- Count column -->
  <div class="w-16 flex-shrink-0 text-center text-xs text-muted-foreground">
    {issueCount}
  </div>
</div>

{#if expanded}
  {#each treeGroup.subgroups as subgroup (subgroup.group.id)}
    <GroupRow
      treeGroup={subgroup}
      depth={depth + 1}
      {expandedKeys}
      {ontoggle}
    />
  {/each}
  {#each treeGroup.projects as treeProject (treeProject.project.id)}
    <ProjectRow
      {treeProject}
      depth={depth + 1}
      {expandedKeys}
      {ontoggle}
    />
  {/each}
{/if}
