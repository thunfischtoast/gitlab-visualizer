// OAuth2 PKCE flow for GitLab

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generate a PKCE code verifier and challenge. */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateRandomString(32);
  const hash = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hash);
  return { codeVerifier, codeChallenge };
}

/** Build the GitLab OAuth authorization URL. */
export function buildAuthUrl(
  gitlabUrl: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read_api",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${gitlabUrl}/oauth/authorize?${params.toString()}`;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(
  gitlabUrl: string,
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthTokenResponse> {
  const response = await fetch(`${gitlabUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/** Refresh an expired access token. */
export async function refreshToken(
  gitlabUrl: string,
  clientId: string,
  currentRefreshToken: string,
): Promise<OAuthTokenResponse> {
  const response = await fetch(`${gitlabUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: currentRefreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token refresh failed: ${response.status}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/** Get the OAuth redirect URI for the current page. */
export function getRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Store the PKCE code verifier in sessionStorage during the redirect. */
export function storeCodeVerifier(verifier: string): void {
  sessionStorage.setItem("oauth_code_verifier", verifier);
}

/** Retrieve and clear the stored PKCE code verifier. */
export function retrieveCodeVerifier(): string | null {
  const verifier = sessionStorage.getItem("oauth_code_verifier");
  if (verifier) sessionStorage.removeItem("oauth_code_verifier");
  return verifier;
}
