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
  App.svelte              # Root component, switches between connection/loading/main views
  app.css                 # Tailwind imports + shadcn-svelte theme variables
  main.ts                 # Entry point
  lib/
    api/                  # GitLab API client, OAuth2 PKCE flow
    stores/               # Svelte 5 rune-based stores (.svelte.ts files)
    types/                # TypeScript interfaces for GitLab entities
    utils/                # Helpers (localStorage, label colors, etc.)
    components/
      ui/                 # shadcn-svelte components (don't edit unless customizing)
      *.svelte            # App-specific components (ConnectionSetup, FilterBar, table rows, etc.)
```

## Key Conventions

- **Svelte 5 only**: Use `$state`, `$derived`, `$effect`. No legacy `$:` reactive statements, no `writable()`/`readable()` stores.
- **Path alias**: Use `$lib/` to import from `src/lib/` (configured in tsconfig + vite.config.ts).
- **Simple code**: No overengineering. Minimal abstractions. When in doubt, ask the user.
- **No SvelteKit**: No filesystem routing, no SSR, no `+page.svelte`. Just `App.svelte` as root.
- **shadcn-svelte imports**: `import { Button } from "$lib/components/ui/button/index.js";`

## Commands

- `npm run dev` — start dev server (localhost:5173)
- `npm run build` — production build
- `npm run check` — TypeScript + Svelte type checking

## UI Patterns

- **Error boundary**: `App.svelte` wraps the entire UI in `<svelte:boundary>` with a `{#snippet failed}` fallback. This catches render errors only — async/event errors are handled per-component.
- **Responsive columns**: Labels hidden below `lg` (1024px), Assignee hidden below `md` (768px). Applied in column headers (HierarchicalTable) and all row components.
- **Transitions**: `out:slide` (not `transition:slide`) on expand/collapse wrappers to avoid intro animation on first mount.
- **Accessibility**: All expandable rows have `role="button"`, `tabindex="0"`, `onkeydown` for Enter/Space (with `e.preventDefault()`), and `focus-visible:ring-2 focus-visible:ring-ring`.

## GitLab API Notes

- Auth: `PRIVATE-TOKEN` header (PAT) or `Authorization: Bearer` (OAuth2)
- Pagination: `per_page=100`, follow `x-next-page` header
- Epics require GitLab Premium — handle 403 gracefully (skip epic level)
- Max 5 concurrent API requests to avoid rate limiting
