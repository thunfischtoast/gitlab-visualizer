<script lang="ts">
  import type { TreeEpic } from "$lib/types/gitlab.js";
  import LabelBadge from "./LabelBadge.svelte";
  import IssueRow from "./IssueRow.svelte";

  interface Props {
    treeEpic: TreeEpic;
    depth: number;
    expanded: boolean;
    ontoggle: () => void;
  }

  let { treeEpic, depth, expanded, ontoggle }: Props = $props();

  let epic = $derived(treeEpic.epic);
  let isNoEpic = $derived(epic === null);
</script>

<div
  class="flex cursor-pointer items-center border-b border-border py-1.5 text-sm hover:bg-accent/50"
  style="padding-left: {depth * 1.5}rem;"
  onclick={ontoggle}
  onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") ontoggle(); }}
  role="button"
  tabindex="0"
>
  <!-- Name column -->
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="inline-block w-4 flex-shrink-0 text-center text-muted-foreground">
      {expanded ? "\u25BE" : "\u25B8"}
    </span>
    {#if isNoEpic}
      <span class="italic text-muted-foreground">No Epic</span>
    {:else if epic}
      <a
        href={epic.web_url}
        target="_blank"
        rel="noopener noreferrer"
        class="truncate text-foreground hover:underline"
        onclick={(e) => e.stopPropagation()}
      >
        <span class="text-muted-foreground">&{epic.iid}</span>
        {epic.title}
      </a>
    {/if}
  </div>

  <!-- Labels column -->
  <div class="flex w-48 flex-shrink-0 flex-wrap gap-1 px-2">
    {#if epic}
      {#each epic.labels as label}
        <LabelBadge {label} />
      {/each}
    {/if}
  </div>

  <!-- Status column -->
  <div class="w-20 flex-shrink-0 text-center text-xs">
    {#if epic}
      <span
        class="inline-block rounded-full px-2 py-0.5"
        class:bg-green-100={epic.state === "opened"}
        class:text-green-800={epic.state === "opened"}
        class:bg-blue-100={epic.state !== "opened"}
        class:text-blue-800={epic.state !== "opened"}
      >
        {epic.state}
      </span>
    {/if}
  </div>

  <!-- Assignee column (empty for epics) -->
  <div class="w-32 flex-shrink-0 px-2"></div>

  <!-- Count column -->
  <div class="w-16 flex-shrink-0 text-center text-xs text-muted-foreground">
    {treeEpic.issues.length}
  </div>
</div>

{#if expanded}
  {#each treeEpic.issues as issue (issue.id)}
    <IssueRow {issue} depth={depth + 1} />
  {/each}
{/if}
