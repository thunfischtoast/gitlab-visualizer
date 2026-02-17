<script lang="ts">
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import LabelBadge from "./LabelBadge.svelte";

  interface Props {
    labels: string[];
  }

  let { labels }: Props = $props();

  let nonScopedLabels = $derived(
    labels.filter((l) => {
      const idx = l.indexOf("::");
      if (idx === -1) return true;
      return !filterStore.activeScopedKeys.includes(l.substring(0, idx));
    }),
  );

  let scopedValues = $derived.by(() => {
    const map: Record<string, string[]> = {};
    for (const label of labels) {
      const idx = label.indexOf("::");
      if (idx !== -1) {
        const key = label.substring(0, idx);
        const value = label.substring(idx + 2);
        (map[key] ??= []).push(value);
      }
    }
    return map;
  });
</script>

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
