<script lang="ts">
  import ConnectionSetup from "$lib/components/ConnectionSetup.svelte";
  import DataLoader from "$lib/components/DataLoader.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import HierarchicalTable from "$lib/components/HierarchicalTable.svelte";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import { dataStore } from "$lib/stores/data.svelte.js";
  import { filterStore } from "$lib/stores/filters.svelte.js";
  import { exchangeCode, getRedirectUri, retrieveCodeVerifier } from "$lib/api/oauth.js";
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
  {#if view === "connection"}
    <ConnectionSetup onconnected={handleConnected} />
    {#if oauthError}
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground">
        {oauthError}
      </div>
    {/if}

  {:else if view === "loading"}
    <DataLoader onloaded={handleLoaded} oncancel={handleLoadCancel} />

  {:else if view === "main"}
    <div class="p-4">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">RACOON GitLab Visualizer</h1>
        <div class="flex gap-2">
          <button
            class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            onclick={handleRefresh}
          >
            Refresh
          </button>
          <button
            class="rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            onclick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      </div>
      <p class="mb-3 text-muted-foreground">
        Loaded {dataStore.groups.length} groups, {dataStore.projects.length} projects, {dataStore.epics.length} epics, {dataStore.issues.length} issues.
        {#if dataStore.cacheTimestamp}
          <span class="text-xs">
            (cached {new Date(dataStore.cacheTimestamp).toLocaleTimeString()})
          </span>
        {/if}
      </p>
      <div class="mb-3">
        <FilterBar />
      </div>
      <HierarchicalTable />
    </div>
  {/if}
</main>
