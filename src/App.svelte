<script lang="ts">
  import { fade } from "svelte/transition";
  import ConnectionSetup from "$lib/components/ConnectionSetup.svelte";
  import DataLoader from "$lib/components/DataLoader.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import HierarchicalTable from "$lib/components/HierarchicalTable.svelte";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import { dataStore } from "$lib/stores/data.svelte.js";
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import { exchangeCode, getRedirectUri, retrieveCodeVerifier } from "$lib/api/oauth.js";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import type { GitLabGroup, GitLabProject, GitLabEpic, GitLabIssue } from "$lib/types/gitlab.js";

  type AppView = "connection" | "loading" | "main";

  // Check for OAuth callback before deciding initial view
  const hasOAuthCode = new URLSearchParams(window.location.search).has("code");

  // Try loading cached data on startup
  const hasFreshCache = connectionStore.isConnected && !hasOAuthCode && dataStore.loadFromCache();

  let view = $state<AppView>(
    hasFreshCache ? "main" :
    connectionStore.isConnected ? "loading" :
    hasOAuthCode ? "loading" :
    "connection"
  );
  let oauthError = $state("");

  // Handle OAuth callback on app load
  async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    // Clean up the URL
    history.replaceState({}, "", window.location.pathname);

    const codeVerifier = retrieveCodeVerifier();
    if (!codeVerifier) {
      oauthError = "OAuth flow interrupted — missing code verifier. Please try again.";
      view = "connection";
      return;
    }

    try {
      const tokenResponse = await exchangeCode(
        connectionStore.gitlabUrl,
        connectionStore.clientId,
        code,
        getRedirectUri(),
        codeVerifier,
      );

      connectionStore.setConnection({
        gitlabUrl: connectionStore.gitlabUrl,
        authMethod: "oauth",
        token: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        clientId: connectionStore.clientId,
      });

      view = "loading";
    } catch (err) {
      oauthError = err instanceof Error ? err.message : "OAuth token exchange failed";
      view = "connection";
    }
  }

  // Run OAuth callback check on mount
  handleOAuthCallback();

  function handleConnected() {
    oauthError = "";
    view = "loading";
  }

  function handleLoaded(data: {
    groups: GitLabGroup[];
    projects: GitLabProject[];
    epics: GitLabEpic[];
    issues: GitLabIssue[];
  }) {
    dataStore.setData(data);
    view = "main";
  }

  function handleLoadCancel() {
    view = "connection";
  }

  function handleRefresh() {
    filterStore.clearFilters();
    view = "loading";
  }

  function handleDisconnect() {
    connectionStore.disconnect();
    dataStore.clear();
    view = "connection";
  }
</script>

<main class="min-h-screen bg-background text-foreground">
  <svelte:boundary onerror={(e) => console.error("App error:", e)}>
    {#if view === "connection"}
      <div class="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <ConnectionSetup onconnected={handleConnected} />
      {#if oauthError}
        <div
          class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg"
          transition:fade={{ duration: 200 }}
        >
          <span>{oauthError}</span>
          <button
            class="ml-1 font-medium underline underline-offset-2"
            onclick={() => { oauthError = ""; }}
          >Dismiss</button>
        </div>
      {/if}

    {:else if view === "loading"}
      <div class="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <DataLoader onloaded={handleLoaded} oncancel={handleLoadCancel} />

    {:else if view === "main"}
      <!-- Sticky header -->
      <div class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div class="mx-auto max-w-screen-2xl px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-lg font-bold">RACOON GitLab Visualizer</h1>
              <p class="text-xs text-muted-foreground">
                {dataStore.groups.length} groups, {dataStore.projects.length} projects, {dataStore.epics.length} epics, {dataStore.issues.length} issues
                {#if dataStore.cacheTimestamp}
                  &middot; cached {new Date(dataStore.cacheTimestamp).toLocaleTimeString()}
                {/if}
              </p>
            </div>
            <div class="flex gap-2">
              <ThemeToggle />
              <button
                class="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={handleRefresh}
              >
                Refresh
              </button>
              <button
                class="rounded-md border px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="mx-auto max-w-screen-2xl px-4 py-3">
        <div class="mb-3">
          <FilterBar />
        </div>
        <HierarchicalTable />
      </div>
    {/if}

    {#snippet failed(error, reset)}
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 class="mb-2 text-lg font-semibold text-destructive">Something went wrong</h2>
          <p class="mb-4 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <div class="flex justify-center gap-2">
            <button
              class="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onclick={reset}
            >
              Try again
            </button>
            <button
              class="rounded-md border px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onclick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    {/snippet}
  </svelte:boundary>
</main>
