# CLAUDE.md

## Project Overview

RACOON GitLab Visualizer V2 — a browser SPA that visualizes GitLab groups, projects, epics, and issues in a hierarchical collapsible table. No backend; all data fetched directly from GitLab REST API v4 and stored in the browser.

See `concept.md` for product goals and `implementation_plan.md` for the full technical plan.

## Tech Stack

- **Svelte 5** (runes: `$state`, `$derived`, `$effect`) + **Vite** — plain SPA, NOT SvelteKit
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **shadcn-svelte** — UI components in `src/lib/components/ui/` (auto-generated, customizable)
- **TypeScript** throughout

## Project Structure

```
src/
  App.svelte              # Root component, switches between connection/group-picker/loading/main views
  app.css                 # Tailwind imports + shadcn-svelte theme variables
  main.ts                 # Entry point
  lib/
    api/                  # GitLab API client, OAuth2 PKCE flow, token refresh
    stores/               # Svelte 5 rune-based stores (.svelte.ts files)
    types/                # TypeScript interfaces for GitLab entities
    utils/                # Helpers (storage, label colors, debug logging)
    components/
      ui/                 # shadcn-svelte components (don't edit unless customizing)
      *.svelte            # App-specific components (ConnectionSetup, GroupPicker, FilterBar, table rows, etc.)
```

## Key Conventions

- **Svelte 5 only**: Use `$state`, `$derived`, `$effect`. No legacy `$:` reactive statements, no `writable()`/`readable()` stores.
- **Path alias**: Use `$lib/` to import from `src/lib/` (configured in tsconfig + vite.config.ts).
- **Simple code**: No overengineering. Minimal abstractions. When in doubt, ask the user.
- **No SvelteKit**: No filesystem routing, no SSR, no `+page.svelte`. Just `App.svelte` as root.
- **shadcn-svelte imports**: `import { Button } from "$lib/components/ui/button/index.js";`

## Commands

- `npm run dev` — start dev server (localhost:5173)
- `npm run build` — production build (also copies `index.html` to `404.html` for SPA routing)
- `npm run check` — TypeScript + Svelte type checking

## App Flow

1. **ConnectionSetup** — user enters GitLab URL + PAT or OAuth2 credentials (URL is validated)
2. **GroupPicker** — user selects which top-level groups to load (selection persisted to localStorage)
3. **DataLoader** — fetches groups, projects, epics, issues with progress bar (supports token refresh on 401)
4. **Main view** — sticky header + FilterBar + HierarchicalTable with expandable rows

## Features

- **Group Picker**: After connecting, users select which top-level groups to visualize. BFS loads all descendant subgroups. Selection persisted in localStorage.
- **Scoped Labels**: Labels with `::` separator (e.g. `Priority::High`) get dedicated filter columns. Default scoped keys: Partner, Priority, State, Type. Users can toggle columns via the "Columns" multi-select.
- **Dark Mode**: Toggle in header on all views. Uses system preference as default, persists choice to localStorage.
- **Token Refresh**: OAuth connections automatically retry on 401 using the refresh token. PAT connections surface the error directly.

## UI Patterns

- **Error boundary**: `App.svelte` wraps the entire UI in `<svelte:boundary>` with a `{#snippet failed}` fallback. This catches render errors only — async/event errors are handled per-component.
- **Responsive columns**: Labels hidden below `lg` (1024px), Assignee hidden below `md` (768px). Applied in column headers (HierarchicalTable) and all row components.
- **Transitions**: `out:slide` (not `transition:slide`) on expand/collapse wrappers to avoid intro animation on first mount.
- **Accessibility**: All expandable rows have `role="button"`, `tabindex="0"`, `onkeydown` for Enter/Space (with `e.preventDefault()`), and `focus-visible:ring-2 focus-visible:ring-ring`.
- **Shared label rendering**: `RowLabels.svelte` handles non-scoped + scoped label columns for both EpicRow and IssueRow.

## Storage

- **localStorage**: Non-sensitive settings (GitLab URL, auth method, client ID, group selection, theme preference, data cache with 1-hour TTL)
- **sessionStorage**: Sensitive tokens (PAT, OAuth access token, refresh token) — cleared when browser closes

## Deployment

- **Base path**: `vite.config.ts` sets `base: "/gitlab-visualizer/"` — change this for different deployment paths
- **SPA routing**: Build script copies `dist/index.html` to `dist/404.html` so all routes serve the app

## GitLab API Notes

- Auth: `PRIVATE-TOKEN` header (PAT) or `Authorization: Bearer` (OAuth2)
- Pagination: `per_page=100`, follow `x-next-page` header
- Epics require GitLab Premium — handle 403 gracefully (skip epic level)
- Max 5 concurrent API requests to avoid rate limiting
- 401 responses trigger automatic token refresh for OAuth connections
