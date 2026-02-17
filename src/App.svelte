<script lang="ts">
  import ConnectionSetup from "$lib/components/ConnectionSetup.svelte";
  import DataLoader from "$lib/components/DataLoader.svelte";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import { exchangeCode, getRedirectUri, retrieveCodeVerifier } from "$lib/api/oauth.js";
  import type { GitLabGroup, GitLabProject, GitLabEpic, GitLabIssue } from "$lib/types/gitlab.js";

  type AppView = "connection" | "loading" | "main";

  let view = $state<AppView>(connectionStore.isConnected ? "loading" : "connection");
  let oauthError = $state("");

  // Loaded data (will be used in Phase 3+)
  let groups = $state<GitLabGroup[]>([]);
  let projects = $state<GitLabProject[]>([]);
  let epics = $state<GitLabEpic[]>([]);
  let issues = $state<GitLabIssue[]>([]);

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
    view = "loading";
  }

  function handleLoaded(data: {
    groups: GitLabGroup[];
    projects: GitLabProject[];
    epics: GitLabEpic[];
    issues: GitLabIssue[];
  }) {
    groups = data.groups;
    projects = data.projects;
    epics = data.epics;
    issues = data.issues;
    view = "main";
  }

  function handleLoadCancel() {
    view = "connection";
  }

  function handleDisconnect() {
    connectionStore.disconnect();
    groups = [];
    projects = [];
    epics = [];
    issues = [];
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
            onclick={() => { view = "loading"; }}
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
      <p class="text-muted-foreground">
        Loaded {groups.length} groups, {projects.length} projects, {epics.length} epics, {issues.length} issues.
      </p>
      <p class="mt-2 text-sm text-muted-foreground">Hierarchical table coming in Phase 4.</p>
    </div>
  {/if}
</main>
