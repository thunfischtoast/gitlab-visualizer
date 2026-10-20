<script lang="ts">
  import { labelColors } from "$lib/utils/labelColor.js";

  interface Props {
    label: string;
  }

  let { label }: Props = $props();

  let colors = $derived(labelColors(label));
</script>

<span
  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium leading-tight"
  style="background-color: {colors.bg}; color: {colors.fg};"
>{label}</span>
