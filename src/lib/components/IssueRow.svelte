<script lang="ts">
  import type { GitLabIssue } from "$lib/types/gitlab.js";
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import RowLabels from "./RowLabels.svelte";

  interface Props {
    issue: GitLabIssue;
    depth: number;
  }

  let { issue, depth }: Props = $props();

  let isOpen = $derived(issue.state === "opened");

  let searchSnippet = $derived(filterStore.getIssueSearchSnippet(issue));
</script>

<div
  class="flex items-center border-b border-border py-1.5 text-sm transition-colors hover:bg-accent/50"
  style="padding-left: {depth * 1.5 + 0.75}rem;"
>
  <!-- Name column -->
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span
      class="inline-block h-2 w-2 flex-shrink-0 rounded-full {isOpen ? 'bg-green-500' : 'bg-blue-500'}"
      title={issue.state}
    ></span>
    <div class="min-w-0 flex-1">
      <a
        href={issue.web_url}
        target="_blank"
        rel="noopener noreferrer"
        class="truncate block text-foreground hover:underline"
      >
        <span class="text-muted-foreground">#{issue.iid}</span>
        {issue.title}
      </a>
      {#if searchSnippet}
        <p class="truncate text-xs text-muted-foreground">
          {searchSnippet.before}<mark class="bg-yellow-200 text-foreground dark:bg-yellow-800">{searchSnippet.match}</mark>{searchSnippet.after}
        </p>
      {/if}
    </div>
  </div>

  <RowLabels labels={issue.labels} />

  <!-- Status column -->
  <div class="w-20 flex-shrink-0 text-center text-xs">
    <span
      class="inline-block rounded-full px-2 py-0.5 {isOpen
        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'}"
    >
      {issue.state}
    </span>
  </div>

  <!-- Assignee column -->
  <div class="hidden w-32 flex-shrink-0 items-center gap-1 px-2 md:flex">
    {#each issue.assignees.slice(0, 3) as assignee}
      <img
        src={assignee.avatar_url}
        alt={assignee.name}
        title={assignee.name}
        class="h-5 w-5 rounded-full"
      />
    {/each}
    {#if issue.assignees.length > 3}
      <span class="text-xs text-muted-foreground">+{issue.assignees.length - 3}</span>
    {/if}
  </div>

  <!-- Count column (empty for issues) -->
  <div class="w-16 flex-shrink-0"></div>
</div>
