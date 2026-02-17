<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { connectionStore } from "$lib/stores/connection.svelte.js";
  import { validateConnection } from "$lib/api/gitlab-api.js";
  import { generatePKCE, buildAuthUrl, getRedirectUri, storeCodeVerifier } from "$lib/api/oauth.js";

  let { onconnected }: { onconnected: () => void } = $props();

  // PAT form state
  let patUrl = $state(connectionStore.gitlabUrl || "");
  let patToken = $state("");

  // OAuth form state
  let oauthUrl = $state(connectionStore.gitlabUrl || "");
  let oauthClientId = $state(connectionStore.clientId || "");

  // Shared state
  let error = $state("");
  let loading = $state(false);

  async function connectWithPAT() {
    error = "";
    loading = true;
    try {
      const config = {
        baseUrl: patUrl.replace(/\/+$/, ""),
        token: patToken,
        authMethod: "pat" as const,
      };
      await validateConnection(config);
      connectionStore.setConnection({
        gitlabUrl: patUrl,
        authMethod: "pat",
        token: patToken,
      });
      onconnected();
    } catch (err) {
      error = err instanceof Error ? err.message : "Connection failed";
    } finally {
      loading = false;
    }
  }

  async function loginWithOAuth() {
    error = "";
    loading = true;
    try {
      const { codeVerifier, codeChallenge } = await generatePKCE();
      storeCodeVerifier(codeVerifier);

      // Store URL and client_id so we can use them after redirect
      connectionStore.setConnection({
        gitlabUrl: oauthUrl,
        authMethod: "oauth",
        token: "", // no token yet
        clientId: oauthClientId,
      });

      const redirectUri = getRedirectUri();
      const authUrl = buildAuthUrl(
        oauthUrl.replace(/\/+$/, ""),
        oauthClientId,
        redirectUri,
        codeChallenge,
      );
      window.location.href = authUrl;
    } catch (err) {
      error = err instanceof Error ? err.message : "OAuth setup failed";
      loading = false;
    }
  }

</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <Card class="w-full max-w-md">
    <CardHeader class="text-center">
      <CardTitle class="text-2xl">RACOON GitLab Visualizer</CardTitle>
      <CardDescription>Connect to your GitLab instance</CardDescription>
    </CardHeader>
    <CardContent>
      <Tabs value="pat">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="pat">Access Token</TabsTrigger>
          <TabsTrigger value="oauth">OAuth2</TabsTrigger>
        </TabsList>

        <TabsContent value="pat">
          <form
            class="mt-4 space-y-4"
            onsubmit={(e) => { e.preventDefault(); connectWithPAT(); }}
          >
            <div class="space-y-2">
              <label for="pat-url" class="text-sm font-medium">GitLab URL</label>
              <Input
                id="pat-url"
                type="url"
                placeholder="https://gitlab.example.com"
                bind:value={patUrl}
              />
            </div>
            <div class="space-y-2">
              <label for="pat-token" class="text-sm font-medium">Personal Access Token</label>
              <Input
                id="pat-token"
                type="password"
                placeholder="glpat-xxxxxxxxxxxx"
                bind:value={patToken}
              />
              <p class="text-xs text-muted-foreground">
                Create a token with <code>read_api</code> scope in GitLab &rarr; Profile &rarr; Access Tokens
              </p>
            </div>
            <Button type="submit" class="w-full" disabled={!patUrl || !patToken || loading}>
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="oauth">
          <form
            class="mt-4 space-y-4"
            onsubmit={(e) => { e.preventDefault(); loginWithOAuth(); }}
          >
            <div class="space-y-2">
              <label for="oauth-url" class="text-sm font-medium">GitLab URL</label>
              <Input
                id="oauth-url"
                type="url"
                placeholder="https://gitlab.example.com"
                bind:value={oauthUrl}
              />
            </div>
            <div class="space-y-2">
              <label for="oauth-client-id" class="text-sm font-medium">Application ID</label>
              <Input
                id="oauth-client-id"
                type="text"
                placeholder="Your OAuth Application ID"
                bind:value={oauthClientId}
              />
              <p class="text-xs text-muted-foreground">
                Register an OAuth app in GitLab &rarr; Profile &rarr; Applications with <code>read_api</code> scope
              </p>
            </div>
            <Button type="submit" class="w-full" disabled={!oauthUrl || !oauthClientId || loading}>
              {loading ? "Redirecting..." : "Login with GitLab"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {#if error}
        <p class="mt-4 text-sm text-destructive">{error}</p>
      {/if}

      <p class="mt-6 text-center text-xs text-muted-foreground">
        No backend server &mdash; your token and all data stay in your browser's local storage and are never sent to a third party.
      </p>
    </CardContent>
  </Card>
</div>
