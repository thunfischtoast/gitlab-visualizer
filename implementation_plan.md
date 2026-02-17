# RACOON GitLab Visualizer V2 - Implementation Plan

## Decisions Made

| Decision | Choice |
|---|---|
| Framework | Svelte 5 + Vite (plain, no SvelteKit) |
| UI / Styling | Tailwind CSS + shadcn-svelte |
| Views | Main hierarchical table only (tab structure ready for extension) |
| Data persistence | LocalStorage |
| GitLab API | REST API v4 |
| Filtering | Text search + label + status (open/closed) + assignee |
| Authentication | Both: Personal Access Token (simple) + OAuth2 with PKCE (seamless) |
| GitLab target | Self-hosted (user provides URL) |
| CORS | Direct browser fetch (GitLab allows CORS with valid token) |

---

## Architecture Overview

```
src/
├── App.svelte                  # Root: connection setup or main UI
├── app.css                     # Global styles / Tailwind imports
├── main.ts                     # Entry point
├── lib/
│   ├── api/
│   │   ├── gitlab-client.ts    # Low-level fetch wrapper (auth, pagination, rate limiting)
│   │   ├── gitlab-api.ts       # High-level: fetchGroups, fetchProjects, fetchEpics, fetchIssues
│   │   └── oauth.ts            # OAuth2 PKCE flow: buildAuthUrl, exchangeCode, refreshToken
│   ├── stores/
│   │   ├── connection.svelte.ts  # GitLab URL + token + auth method (persisted)
│   │   ├── data.svelte.ts        # Fetched data: groups, projects, epics, issues
│   │   └── filters.svelte.ts     # Active filter state
│   ├── types/
│   │   └── gitlab.ts           # TypeScript interfaces for GitLab entities
│   ├── utils/
│   │   ├── storage.ts          # LocalStorage read/write helpers
│   │   └── helpers.ts          # Label colors, URL building, etc.
│   └── components/
│       └── ui/                 # shadcn-svelte components (auto-generated)
├── components/
│   ├── ConnectionSetup.svelte  # URL + token input form
│   ├── DataLoader.svelte       # Fetch progress indicator
│   ├── MainLayout.svelte       # Top bar + tab container + content
│   ├── FilterBar.svelte        # Search, label, status, assignee filters
│   ├── HierarchicalTable.svelte  # The main collapsible tree table
│   ├── GroupRow.svelte         # Expandable group row
│   ├── ProjectRow.svelte       # Expandable project row
│   ├── EpicRow.svelte          # Expandable epic row
│   ├── IssueRow.svelte         # Leaf issue row
│   └── LabelBadge.svelte      # Colored label chip
```

---

## Data Model

### GitLab Hierarchy

```
Group (can have subgroups)
├── Project
│   ├── Epic (epics belong to groups but we show them per-project via linked issues)
│   │   └── Issue (linked to this epic)
│   └── Issues (not linked to any epic, shown under "No Epic")
```

### TypeScript Interfaces

```typescript
interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
  web_url: string;
  parent_id: number | null;
}

interface GitLabProject {
  id: number;
  name: string;
  web_url: string;
  namespace: { id: number; full_path: string };
}

interface GitLabEpic {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  group_id: number;
  labels: string[];
  state: string;
}

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  project_id: number;
  state: string;            // "opened" | "closed"
  labels: string[];
  assignees: { name: string; username: string; avatar_url: string }[];
  epic_iid: number | null;
  milestone: { title: string } | null;
}
```

### Processed Tree Structure (for rendering)

```typescript
interface TreeGroup {
  group: GitLabGroup;
  projects: TreeProject[];
  expanded: boolean;
}

interface TreeProject {
  project: GitLabProject;
  epics: TreeEpic[];        // includes a synthetic "No Epic" entry
  expanded: boolean;
}

interface TreeEpic {
  epic: GitLabEpic | null;  // null = "No Epic" bucket
  issues: GitLabIssue[];
  expanded: boolean;
}
```

---

## Authentication

### Option A: Personal Access Token (PAT)

User creates a token in GitLab (Profile → Access Tokens) with `read_api` scope and pastes it into the app. The app sends it as `PRIVATE-TOKEN` header on every API request.

- **Pros**: Zero setup on GitLab side, works on any instance/tier.
- **Cons**: User must manually create and manage the token.

### Option B: OAuth2 Authorization Code with PKCE

Standard OAuth2 flow for browser-based apps (no backend needed):

1. **One-time setup**: User (or GitLab admin) registers an OAuth Application on the GitLab instance:
   - GitLab → Profile → Applications (or Admin → Applications for instance-wide)
   - Name: "RACOON Visualizer"
   - Redirect URI: the app's URL (e.g. `http://localhost:5173/oauth/callback`)
   - Scopes: `read_api`
   - Confidential: **No** (public client for SPA)
   - This produces a `client_id` (called "Application ID" in GitLab)

2. **Auth flow** (happens in the browser):
   ```
   App                          GitLab
    │                              │
    │  Generate code_verifier      │
    │  + code_challenge (SHA256)   │
    │                              │
    │──── Redirect to /oauth/authorize ──→│
    │     ?client_id=...           │
    │     &redirect_uri=...        │
    │     &response_type=code      │
    │     &scope=read_api          │
    │     &code_challenge=...      │
    │     &code_challenge_method=S256
    │                              │
    │     User logs in & authorizes│
    │                              │
    │←── Redirect back with ?code=... ───│
    │                              │
    │──── POST /oauth/token ──────→│
    │     grant_type=authorization_code
    │     &code=...                │
    │     &redirect_uri=...        │
    │     &client_id=...           │
    │     &code_verifier=...       │
    │                              │
    │←── { access_token, refresh_token } │
   ```

3. **Token usage**: Sent as `Authorization: Bearer <token>` header.
4. **Token refresh**: When the access token expires, use the refresh token to get a new one via `POST /oauth/token` with `grant_type=refresh_token`.

### Implementation Notes

- `oauth.ts` handles: generating PKCE challenge, building the auth URL, exchanging the code, refreshing tokens.
- `gitlab-client.ts` accepts a token regardless of source (PAT or OAuth). The only difference is the header: `PRIVATE-TOKEN` for PAT, `Authorization: Bearer` for OAuth.
- The OAuth callback is handled by checking `window.location` for a `?code=` parameter on app load. Since this is a SPA (no server-side routing), we parse the URL, exchange the code, then clean up the URL with `history.replaceState`.
- `code_verifier` is stored in `sessionStorage` during the redirect (cleared after exchange).
- `client_id` + GitLab URL are persisted in LocalStorage so the user doesn't re-enter them.

---

## GitLab API Strategy

### Endpoints

| Data | Endpoint | Pagination |
|---|---|---|
| Groups | `GET /api/v4/groups?top_level_only=false&per_page=100` | Yes |
| Projects per group | `GET /api/v4/groups/:id/projects?per_page=100&include_subgroups=true` | Yes |
| Epics per group | `GET /api/v4/groups/:id/epics?per_page=100` | Yes (may 403 without Premium) |
| Issues per project | `GET /api/v4/projects/:id/issues?per_page=100` | Yes |

### Pagination Handling

- Use `per_page=100` (max allowed).
- Read `x-next-page` header; keep fetching until empty.
- Show progress: "Fetching issues... (page 3/7)".

### Error Handling

- **401**: Invalid token → show error, return to connection setup.
- **403 on epics**: GitLab Free tier doesn't have epics → skip gracefully, flatten hierarchy to Group → Project → Issue.
- **429 rate limit**: Back off and retry with exponential delay.
- **Network error**: Show retry option.

### Fetch Sequence

1. Fetch all groups (single paginated call).
2. For each group: fetch projects (parallel, batched).
3. For each group: try fetching epics (parallel, graceful 403 handling).
4. For each project: fetch issues (parallel, batched).
5. Build the tree structure by linking issues → epics → projects → groups.

Batching: max 5 concurrent requests to avoid rate limiting.

---

## UI Design

### Screen 1: Connection Setup

A centered card with two auth methods (tabs or toggle):

**Option A: Personal Access Token (simple)**
- Text input: GitLab instance URL (e.g. `https://gitlab.example.com`)
- Password input: Personal Access Token
- "Connect" button
- Connection is validated by calling `GET /api/v4/user` before proceeding.

**Option B: OAuth2 Login (seamless)**
- Text input: GitLab instance URL
- Text input: Application ID (client_id) — with a help link explaining how to register an OAuth app on GitLab
- "Login with GitLab" button → redirects to GitLab's authorization page
- After authorization, GitLab redirects back with a code; app exchanges it for a token.
- Token refreshes automatically when it expires.

Both methods: URL + credentials are saved to LocalStorage. A "Disconnect" action clears them.

### Screen 2: Data Loading

- Full-screen progress view.
- Shows current phase: "Fetching groups...", "Fetching projects...", "Fetching issues..."
- Progress bar based on completed/total API calls.
- "Cancel" button to abort.

### Screen 3: Main View

```
┌──────────────────────────────────────────────────────┐
│ RACOON GitLab Visualizer    [Refresh] [Disconnect]   │
├──────────────────────────────────────────────────────┤
│ [🔍 Search...] [Labels ▾] [Status ▾] [Assignee ▾]   │
├──────────────────────────────────────────────────────┤
│ ▸ Group: Platform Team                    12 issues  │
│ ▾ Group: Backend Services                 34 issues  │
│   ▸ Project: auth-service                  8 issues  │
│   ▾ Project: api-gateway                  14 issues  │
│     ▾ Epic: API v2 Migration (#5)          6 issues  │
│       ● #142 Migrate /users endpoint  [api][v2] Open │
│       ● #143 Migrate /auth endpoint   [api][v2] Open │
│       ○ #138 Update API docs          [docs] Closed  │
│     ▸ Epic: Performance (#8)               4 issues  │
│     ▾ (No Epic)                            4 issues  │
│       ● #150 Fix memory leak       [bug] Open       │
│   ▸ Project: worker-service               12 issues  │
└──────────────────────────────────────────────────────┘
```

### Table Columns

| Column | Content |
|---|---|
| Name / Title | Indented, with expand/collapse chevron. Shows group name, project name, epic title + IID, or issue title + IID |
| Labels | Colored badges |
| Status | Open/Closed indicator (for issues and epics) |
| Assignee | Avatar + name (issues only) |
| Count | Issue count (for groups, projects, epics) |

### Filtering Behavior

- **Text search**: Filters issues by title match. Parent groups/projects/epics stay visible if they contain matching issues.
- **Label filter**: Multi-select dropdown of all labels found in the data. Filters issues that have ANY of the selected labels.
- **Status filter**: "All", "Open", "Closed".
- **Assignee filter**: Dropdown of all assignees found in the data.
- Filters combine with AND logic (text AND label AND status AND assignee).

### Sorting

- Issues within an epic: by IID (default), by title, by status.
- Sortable via column header click.

### Interactivity

- Clicking an issue/epic title opens the GitLab URL in a new tab.
- Expand/collapse state is preserved during filtering.
- "Expand All" / "Collapse All" buttons in the toolbar.

---

## Implementation Phases

### Phase 1: Project Scaffolding
- Create Svelte + Vite + TypeScript project.
- Add Tailwind CSS.
- Initialize shadcn-svelte, add needed components (Button, Input, Badge, Table, Collapsible, Select, Command, Dialog, Separator, Card, Progress, Tabs).
- Set up path aliases (`$lib`).
- Verify dev server works.

### Phase 2: Connection & API Layer
- Implement `gitlab-client.ts` (fetch wrapper with auth header, pagination, error handling, concurrency limiting). Supports both `PRIVATE-TOKEN` (PAT) and `Authorization: Bearer` (OAuth) headers.
- Implement `oauth.ts` (PKCE challenge generation, auth URL builder, code exchange, token refresh).
- Implement `gitlab-api.ts` (high-level functions: validateConnection, fetchAllGroups, fetchProjectsForGroup, fetchEpicsForGroup, fetchIssuesForProject).
- Implement `connection.svelte.ts` store (URL + token + auth method + OAuth client_id, persisted to LocalStorage).
- Build `ConnectionSetup.svelte` (tabbed form: PAT tab and OAuth tab, with validation).
- Handle OAuth callback on app load (detect `?code=` param, exchange for token).
- Build `DataLoader.svelte` (progress UI during fetch).

### Phase 3: Data Processing & Storage
- Define TypeScript types in `gitlab.ts`.
- Implement tree-building logic: raw API data → nested TreeGroup/TreeProject/TreeEpic structure.
- Implement LocalStorage persistence (save/load full dataset with timestamp).
- On app load: if cached data exists and is < 1 hour old, use it; otherwise re-fetch.
- Implement `data.svelte.ts` store.

### Phase 4: Hierarchical Table
- Build `HierarchicalTable.svelte` as the main component.
- Build row components: `GroupRow`, `ProjectRow`, `EpicRow`, `IssueRow`.
- Implement expand/collapse with indentation.
- Implement `LabelBadge.svelte` (colored chips based on label name hash).
- Add issue count badges on group/project/epic rows.
- Make titles clickable (open GitLab URL in new tab).
- Add "Expand All" / "Collapse All" controls.

### Phase 5: Filtering & Sorting
- Build `FilterBar.svelte` with text search input, label multi-select, status dropdown, assignee dropdown.
- Implement `filters.svelte.ts` store.
- Implement derived filtered tree: apply filters to issues, propagate visibility upward (keep parent visible if any child matches).
- Add column sorting (click header to sort issues within their group).

### Phase 6: Polish
- Responsive layout adjustments.
- Empty states ("No issues match your filters").
- Error boundaries and user-friendly error messages.
- "Refresh data" button (re-fetch from GitLab).
- "Disconnect" button (clear token + data).
- Loading skeletons during initial render.
- Keyboard navigation basics (Enter to expand/collapse).
- Final visual polish: consistent spacing, hover states, transitions.

---

## Key Technical Notes

- **No SvelteKit**: This is a plain Svelte 5 + Vite SPA. No server-side rendering, no filesystem routing. Just `App.svelte` as the root.
- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect` for reactivity. No legacy `$:` or writable stores.
- **shadcn-svelte components** are copied into `src/lib/components/ui/` and can be customized directly.
- **CORS fallback**: If direct browser calls fail due to CORS, we document how to configure Vite proxy as a workaround for development.
- **Epics graceful degradation**: If the GitLab instance doesn't support epics (Free tier), the hierarchy becomes Group → Project → Issue (no epic level).
- **LocalStorage limit**: ~5-10MB. For very large GitLab instances, we may need to store only essential fields. If we hit the limit, we fall back to in-memory only and warn the user.
