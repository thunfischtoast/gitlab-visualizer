export type AuthMethod = "pat" | "oauth";

export interface ClientConfig {
  baseUrl: string;
  token: string;
  authMethod: AuthMethod;
  /** Optional callback to refresh an expired token. Returns the new token, or null if refresh failed. */
  refreshAuth?: () => Promise<string | null>;
}

export class GitLabApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitLabApiError";
  }
}

// Simple concurrency limiter — max N concurrent requests
function createConcurrencyLimiter(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && running < max) {
      running++;
      const resolve = queue.shift()!;
      resolve();
    }
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      running++;
    }
    try {
      return await fn();
    } finally {
      running--;
      next();
    }
  };
}

const limiter = createConcurrencyLimiter(5);

function buildHeaders(config: ClientConfig): Record<string, string> {
  if (config.authMethod === "pat") {
    return { "PRIVATE-TOKEN": config.token };
  }
  return { Authorization: `Bearer ${config.token}` };
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, { headers, signal });

    if (response.status === 429) {
      // Rate limited — back off exponentially
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!response.ok) {
      throw new GitLabApiError(
        response.status,
        `GitLab API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  throw new GitLabApiError(429, "Rate limited — too many retries");
}

/**
 * Try refreshing the auth token on 401. Returns updated headers if successful.
 * Throws the original error if refresh is not available or fails.
 */
async function handleUnauthorized(
  config: ClientConfig,
  originalError: GitLabApiError,
): Promise<Record<string, string>> {
  if (!config.refreshAuth) throw originalError;

  const newToken = await config.refreshAuth();
  if (!newToken) throw originalError;

  config.token = newToken;
  return buildHeaders(config);
}

/** Fetch a single page from the GitLab API. */
export async function apiFetch<T>(
  config: ClientConfig,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${config.baseUrl}/api/v4${path}`;

  try {
    return await limiter(async () => {
      const headers = buildHeaders(config);
      const response = await fetchWithRetry(url, headers, signal);
      return response.json() as Promise<T>;
    });
  } catch (err) {
    if (err instanceof GitLabApiError && err.status === 401) {
      const newHeaders = await handleUnauthorized(config, err);
      return limiter(async () => {
        const response = await fetchWithRetry(url, newHeaders, signal);
        return response.json() as Promise<T>;
      });
    }
    throw err;
  }
}

/** Fetch all pages of a paginated GitLab API endpoint. */
export async function apiFetchAllPages<T>(
  config: ClientConfig,
  path: string,
  signal?: AbortSignal,
  onPage?: (page: number) => void,
): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  let results: T[] = [];
  let page = 1;

  while (true) {
    const url = `${config.baseUrl}/api/v4${path}${separator}per_page=100&page=${page}`;

    try {
      const response = await limiter(async () => {
        const headers = buildHeaders(config);
        return fetchWithRetry(url, headers, signal);
      });

      const data = (await response.json()) as T[];
      results = results.concat(data);
      onPage?.(page);

      const nextPage = response.headers.get("x-next-page");
      if (!nextPage) break;
      page = parseInt(nextPage, 10);
      if (isNaN(page)) break;
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 401) {
        const newHeaders = await handleUnauthorized(config, err);
        // Retry the current page with refreshed token
        const response = await limiter(async () => {
          return fetchWithRetry(url, newHeaders, signal);
        });

        const data = (await response.json()) as T[];
        results = results.concat(data);
        onPage?.(page);

        const nextPage = response.headers.get("x-next-page");
        if (!nextPage) break;
        page = parseInt(nextPage, 10);
        if (isNaN(page)) break;
      } else {
        throw err;
      }
    }
  }

  return results;
}
