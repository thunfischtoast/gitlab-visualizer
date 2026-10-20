<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { buildExportHtml } from "$lib/utils/exportHtml.js";

  let open = $state(false);
  let html = $state("");
  let copyStatus = $state<"" | "copied" | "failed">("");

  function handleOpenChange(value: boolean) {
    // Snapshot the view when the dialog opens
    if (value) {
      html = buildExportHtml();
      copyStatus = "";
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      copyStatus = "copied";
    } catch {
      // Clipboard API needs a secure context and permission; manual selection still works
      copyStatus = "failed";
    }
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Trigger
    class="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    Export as HTML
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title>Export as HTML</Dialog.Title>
      <Dialog.Description>
        Static snapshot of the current table (filters, columns, expanded rows). Paste it into a Confluence HTML macro.
      </Dialog.Description>
    </Dialog.Header>
    <textarea
      readonly
      class="h-80 w-full resize-none rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={html}
      onfocus={(e) => e.currentTarget.select()}
    ></textarea>
    <Dialog.Footer>
      <button
        class="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onclick={copy}
      >
        {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed, select text manually" : "Copy"}
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
