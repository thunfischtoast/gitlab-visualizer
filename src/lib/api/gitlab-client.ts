export type AuthMethod = "pat" | "oauth";

export interface ClientConfig {
  baseUrl: string;
  token: string;
  authMethod: AuthMethod;
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

    if (response.status === 401) {
      throw new GitLabApiError(401, "Invalid or expired token");
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

/** Fetch a single page from the GitLab API. */
export async function apiFetch<T>(
  config: ClientConfig,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${config.baseUrl}/api/v4${path}`;
  const headers = buildHeaders(config);

  return limiter(async () => {
    const response = await fetchWithRetry(url, headers, signal);
    return response.json() as Promise<T>;
  });
}

/** Fetch all pages of a paginated GitLab API endpoint. */
export async function apiFetchAllPages<T>(
  config: ClientConfig,
  path: string,
  signal?: AbortSignal,
  onPage?: (page: number) => void,
): Promise<T[]> {
  const headers = buildHeaders(config);
  const separator = path.includes("?") ? "&" : "?";
  let results: T[] = [];
  let page = 1;

  while (true) {
    const url = `${config.baseUrl}/api/v4${path}${separator}per_page=100&page=${page}`;

    const response = await limiter(async () => {
      return fetchWithRetry(url, headers, signal);
    });

    const data = (await response.json()) as T[];
    results = results.concat(data);
    onPage?.(page);

    const nextPage = response.headers.get("x-next-page");
    if (!nextPage) break;
    page = parseInt(nextPage, 10);
    if (isNaN(page)) break;
  }

  return results;
}
