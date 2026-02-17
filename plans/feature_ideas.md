# Feature Ideas

## High Impact

### 1. Milestone / Iteration View

Show milestones alongside epics. GitLab milestones are widely used for sprint planning — displaying them as a grouping option (or as a column) would help teams track sprint progress directly in the visualizer.

### 2. Issue Detail Side Panel

Clicking an issue opens a slide-over panel showing description, comments count, time tracking, due date, weight, and related MRs — without leaving the app. Avoids constant tab-switching to GitLab.

### 3. Keyboard Shortcuts

`/` to focus search, `j`/`k` to navigate rows, `x` to expand/collapse, `Esc` to clear filters. Power users managing hundreds of issues would benefit a lot.

### 4. Bookmarkable Filter State via URL Hash

Encode current filters (search, labels, status, assignee) into the URL hash so users can share a specific filtered view with teammates or bookmark it.

### 5. Export to CSV / Clipboard

Export the currently filtered/visible issues as CSV or copy a markdown table to clipboard — useful for standups, reports, or pasting into Confluence/Notion.

## Medium Impact

### 6. Dark Mode Toggle

The shadcn-svelte theme already supports dark mode via CSS variables. Add a toggle button in the header to switch themes, persisted to localStorage.

### 7. Due Date Column + Overdue Highlighting

Show issue due dates with red highlighting for overdue items. Helps teams spot slipping deadlines at a glance.

### 8. Weight / Story Points Column

Display issue weight and show aggregated weight per epic/project. Useful for capacity planning.

### 9. Drag-and-Drop Column Reordering / Column Visibility Toggle

Let users choose which columns are visible and in what order. Not everyone needs Labels or Assignees — some want Due Date or Weight instead.

### 10. Saved Filter Presets

Let users save named filter combinations (e.g., "My Open Bugs", "Sprint 42 Backend") to localStorage and recall them with one click.

## Nice to Have

### 11. Merge Request Awareness

Show an icon on issues that have linked open MRs, and optionally show MR pipeline status (green/red/pending). Helps see which issues are "in review."

### 12. Issue Count Sparkline / Mini Charts

Small inline bar chart per group/project showing open vs. closed issue ratio. Gives a quick health-at-a-glance without expanding.

### 13. Multi-Instance Support

Allow connecting to multiple GitLab instances simultaneously (e.g., company GitLab + open-source GitLab.com) and show them side by side or merged.

### 14. Selective Group Loading

After connecting, show a group picker where users choose which groups to load instead of fetching everything. Speeds up initial load for large instances.

### 15. Real-Time Updates via Polling

Optional auto-refresh on a configurable interval (e.g., every 5 min) with a subtle diff indicator showing what changed since last load.
