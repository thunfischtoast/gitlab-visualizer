<script lang="ts">
  interface Props {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onchange: (selected: string[]) => void;
  }

  let { label, options, selected, onchange }: Props = $props();

  let open = $state(false);
  let search = $state("");
  let containerEl: HTMLDivElement | undefined = $state();

  let filteredOptions = $derived(
    search
      ? options.filter((o) =>
          o.label.toLowerCase().includes(search.toLowerCase()),
        )
      : options,
  );

  function toggle(value: string) {
    if (selected.includes(value)) {
      onchange(selected.filter((v) => v !== value));
    } else {
      onchange([...selected, value]);
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="relative" bind:this={containerEl}>
  <button
    class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
    onclick={() => {
      open = !open;
      if (!open) search = "";
    }}
  >
    {label}
    {#if selected.length > 0}
      <span
        class="rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
        >{selected.length}</span
      >
    {/if}
    <span class="text-muted-foreground">{open ? "\u25B4" : "\u25BE"}</span>
  </button>

  {#if open}
    <div
      class="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md"
    >
      {#if options.length > 8}
        <input
          type="text"
          placeholder="Search..."
          class="mb-2 w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring"
          bind:value={search}
        />
      {/if}
      <div class="max-h-48 overflow-y-auto">
        {#each filteredOptions as option (option.value)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onchange={() => toggle(option.value)}
              class="accent-primary"
            />
            <span class="truncate">{option.label}</span>
          </label>
        {/each}
        {#if filteredOptions.length === 0}
          <div class="px-2 py-1 text-sm text-muted-foreground">No matches</div>
        {/if}
      </div>
      {#if selected.length > 0}
        <button
          class="mt-1 w-full rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          onclick={() => onchange([])}
        >
          Clear all
        </button>
      {/if}
    </div>
  {/if}
</div>
