# RACOON GitLab Visualizer

A browser-based tool for navigating complex GitLab instances. Provides a hierarchical, collapsible overview of Groups, Projects, Epics, and Issues with filtering and sorting.

All data stays in your browser — nothing is sent to third parties.

## Features

- **Hierarchical tree view**: Groups > Projects > Epics > Issues, all collapsible with expand/collapse all
- **Two auth methods**: Paste a Personal Access Token, or use OAuth2 login (PKCE)
- **Works with self-hosted GitLab**: Enter any GitLab instance URL
- **Filtering**: Search by text, label, status (open/closed), or assignee
- **Sorting**: Click column headers to sort issues by title, status, or IID
- **Labels**: Displayed as colored badges
- **Clickable links**: Titles link back to GitLab originals
- **Local caching**: Fetched data is cached in LocalStorage (1-hour TTL) to avoid re-fetching
- **Responsive**: Labels and assignee columns hide on smaller screens
- **Keyboard accessible**: Enter/Space to expand/collapse, focus-visible rings on all interactive elements
- **Error recovery**: Error boundary with retry, per-component error handling for API failures

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Connecting to GitLab

**Option A: Personal Access Token**

1. In your GitLab instance, go to Profile > Access Tokens
2. Create a token with `read_api` scope
3. Enter your GitLab URL and token in the app

**Option B: OAuth2 Login**

1. In your GitLab instance, go to Profile > Applications (or ask an admin)
2. Create an application with:
   - Redirect URI: `http://localhost:5173` (or wherever you host the app)
   - Scopes: `read_api`
   - Confidential: No
3. Copy the Application ID
4. Enter your GitLab URL and Application ID in the app, then click "Login with GitLab"

## Tech Stack

- [Svelte 5](https://svelte.dev/) + [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn-svelte](https://shadcn-svelte.com/) (UI components)
- GitLab REST API v4

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript + Svelte type checking |
