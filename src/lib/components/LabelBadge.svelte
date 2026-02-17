<script lang="ts">
  const PALETTE = [
    "#e05d44", "#4c1", "#007ec6", "#dfb317", "#fe7d37",
    "#9f78c4", "#a4a61d", "#e85d75", "#44cc11", "#2196f3",
    "#00bcd4", "#ff5722",
  ];

  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function textColor(bg: string): string {
    // Parse hex color and compute relative luminance
    const hex = bg.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
  }

  // Normalize short hex like "#4c1" to "#44cc11"
  function normalizeHex(hex: string): string {
    const h = hex.replace("#", "");
    if (h.length === 3) {
      return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return hex;
  }

  interface Props {
    label: string;
  }

  let { label }: Props = $props();

  let bgColor = $derived(normalizeHex(PALETTE[hashString(label) % PALETTE.length]));
  let fgColor = $derived(textColor(bgColor));
</script>

<span
  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium leading-tight"
  style="background-color: {bgColor}; color: {fgColor};"
>{label}</span>
