import { loadFromStorage, saveToStorage, removeFromStorage } from "$lib/utils/storage.js";
import type { AuthMethod } from "$lib/api/gitlab-client.js";

const STORAGE_KEY = "gitlab-connection";

interface ConnectionData {
  gitlabUrl: string;
  authMethod: AuthMethod;
  token: string;
  refreshToken: string;
  clientId: string;
}

const stored = loadFromStorage<ConnectionData | null>(STORAGE_KEY, null);

let gitlabUrl = $state(stored?.gitlabUrl ?? "");
let authMethod = $state<AuthMethod>(stored?.authMethod ?? "pat");
let token = $state(stored?.token ?? "");
let refreshToken = $state(stored?.refreshToken ?? "");
let clientId = $state(stored?.clientId ?? "");

const isConnected = $derived(!!gitlabUrl && !!token);

function persist() {
  saveToStorage(STORAGE_KEY, {
    gitlabUrl,
    authMethod,
    token,
    refreshToken,
    clientId,
  });
}

function setConnection(data: {
  gitlabUrl: string;
  authMethod: AuthMethod;
  token: string;
  refreshToken?: string;
  clientId?: string;
}) {
  gitlabUrl = data.gitlabUrl.replace(/\/+$/, ""); // strip trailing slash
  authMethod = data.authMethod;
  token = data.token;
  refreshToken = data.refreshToken ?? "";
  clientId = data.clientId ?? "";
  persist();
}

function updateTokens(newToken: string, newRefreshToken: string) {
  token = newToken;
  refreshToken = newRefreshToken;
  persist();
}

function disconnect() {
  gitlabUrl = "";
  authMethod = "pat";
  token = "";
  refreshToken = "";
  clientId = "";
  removeFromStorage(STORAGE_KEY);
}

export const connectionStore = {
  get gitlabUrl() { return gitlabUrl; },
  get authMethod() { return authMethod; },
  get token() { return token; },
  get refreshToken() { return refreshToken; },
  get clientId() { return clientId; },
  get isConnected() { return isConnected; },
  setConnection,
  updateTokens,
  disconnect,
};
