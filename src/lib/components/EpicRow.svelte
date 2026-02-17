<script lang="ts">
  import { slide } from "svelte/transition";
  import type { TreeEpic } from "$lib/types/gitlab.js";
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import LabelBadge from "./LabelBadge.svelte";
  import IssueRow from "./IssueRow.svelte";
  import { checkDuplicateKeys } from "$lib/utils/debug.js";

  interface Props {
    treeEpic: TreeEpic;
    depth: number;
    expanded: boolean;
    ontoggle: () => void;
  }

  let { treeEpic, depth, expanded, ontoggle }: Props = $props();

  let epic = $derived(treeEpic.epic);

  let nonScopedLabels = $derived(
    epic
      ? epic.labels.filter((l: string) => {
          const idx = l.indexOf("::");
          if (idx === -1) return true;
          return !filterStore.activeScopedKeys.includes(l.substring(0, idx));
        })
      : [],
  );

  let scopedValues = $derived.by(() => {
    if (!epic) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    for (const label of epic.labels) {
      const idx = label.indexOf("::");
      if (idx !== -1) {
        const key = label.substring(0, idx);
        const value = label.substring(idx + 2);
        (map[key] ??= []).push(value);
      }
    }
    return map;
  });

  let searchSnippet = $derived(
    epic ? filterStore.getEpicSearchSnippet(epic) : null,
  );

  // Debug: check for duplicate issue keys
  $effect(() => {
    if (expanded) {
      checkDuplicateKeys(
        "EpicRow",
        `issues in epic "${epic?.title ?? "No Epic"}" (id=${epic?.id ?? "none"})`,
        treeEpic.issues,
        (i) => i.id,
      );
    }
  });
</script>

<div
  class="flex cursor-pointer items-center border-b border-border py-1.5 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  style="padding-left: {depth * 1.5}rem;"
  onclick={ontoggle}
  onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ontoggle(); } }}
  role="button"
  tabindex="0"
>
  <!-- Name column -->
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="inline-block w-4 flex-shrink-0 text-center text-muted-foreground">
      {expanded ? "\u25BE" : "\u25B8"}
    </span>
    {#if epic === null}
      <span class="italic text-muted-foreground">No Epic</span>
    {:else if epic}
      <div class="min-w-0 flex-1">
        <a
          href={epic.web_url}
          target="_blank"
          rel="noopener noreferrer"
          class="truncate block text-foreground hover:underline"
          onclick={(e) => e.stopPropagation()}
        >
          <span class="text-muted-foreground">&amp;{epic.iid}</span>
          {epic.title}
        </a>
        {#if searchSnippet}
          <p class="truncate text-xs text-muted-foreground">
            {searchSnippet.before}<mark class="bg-yellow-200 text-foreground dark:bg-yellow-800">{searchSnippet.match}</mark>{searchSnippet.after}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Labels column (non-scoped only) -->
  <div class="hidden w-48 flex-shrink-0 flex-wrap gap-1 px-2 lg:flex">
    {#each nonScopedLabels as label}
      <LabelBadge {label} />
    {/each}
  </div>

  <!-- Scoped label columns -->
  {#each filterStore.activeScopedKeys as key}
    <div class="hidden w-28 flex-shrink-0 flex-wrap gap-1 px-2 lg:flex">
      {#each scopedValues[key] ?? [] as value}
        <LabelBadge label={value} />
      {/each}
    </div>
  {/each}

  <!-- Status column -->
  <div class="w-20 flex-shrink-0 text-center text-xs">
    {#if epic}
      <span
        class="inline-block rounded-full px-2 py-0.5 {epic.state === 'opened'
          ? 'bg-green-500/15 text-green-700 dark:text-green-400'
          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'}"
      >
        {epic.state}
      </span>
    {/if}
  </div>

  <!-- Assignee column (empty for epics) -->
  <div class="hidden w-32 flex-shrink-0 px-2 md:block"></div>

  <!-- Count column -->
  <div class="w-16 flex-shrink-0 text-center text-xs text-muted-foreground">
    {treeEpic.issues.length}
  </div>
</div>

{#if expanded}
  <div out:slide={{ duration: 150 }}>
    {#each treeEpic.issues as issue (issue.id)}
      <IssueRow {issue} depth={depth + 1} />
    {/each}
  </div>
{/if}
