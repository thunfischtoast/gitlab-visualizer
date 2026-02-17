import { loadFromStorage, saveToStorage, removeFromStorage, loadFromSession, saveToSession, removeFromSession } from "$lib/utils/storage.js";
import type { AuthMethod } from "$lib/api/gitlab-client.js";

const SETTINGS_KEY = "gitlab-connection";
const TOKEN_KEY = "gitlab-tokens";

interface ConnectionSettings {
  gitlabUrl: string;
  authMethod: AuthMethod;
  clientId: string;
}

interface TokenData {
  token: string;
  refreshToken: string;
}

const storedSettings = loadFromStorage<ConnectionSettings | null>(SETTINGS_KEY, null);
const storedTokens = loadFromSession<TokenData | null>(TOKEN_KEY, null);

let gitlabUrl = $state(storedSettings?.gitlabUrl ?? "");
let authMethod = $state<AuthMethod>(storedSettings?.authMethod ?? "pat");
let token = $state(storedTokens?.token ?? "");
let refreshToken = $state(storedTokens?.refreshToken ?? "");
let clientId = $state(storedSettings?.clientId ?? "");

const isConnected = $derived(!!gitlabUrl && !!token);

function persistSettings() {
  saveToStorage(SETTINGS_KEY, {
    gitlabUrl,
    authMethod,
    clientId,
  });
}

function persistTokens() {
  saveToSession(TOKEN_KEY, {
    token,
    refreshToken,
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
  persistSettings();
  persistTokens();
}

function updateTokens(newToken: string, newRefreshToken: string) {
  token = newToken;
  refreshToken = newRefreshToken;
  persistTokens();
}

function disconnect() {
  gitlabUrl = "";
  authMethod = "pat";
  token = "";
  refreshToken = "";
  clientId = "";
  removeFromStorage(SETTINGS_KEY);
  removeFromSession(TOKEN_KEY);
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
