import { filterStore, type SearchSnippet } from "$lib/stores/filters.svelte.js";
import { countIssues } from "$lib/utils/tree.js";
import { labelColors } from "$lib/utils/labelColor.js";
import type { GitLabIssue, TreeEpic, TreeGroup, TreeProject } from "$lib/types/gitlab.js";

// Light-theme colors matching the app's zinc palette. Inline styles only, so the
// output can be pasted into a Confluence HTML macro without leaking CSS.
const FG = "#18181b";
const MUTED = "#71717a";
const BORDER = "#e4e4e7";
const INDENT_PX = 24;
const MARKER_PX = 20;
const NAME_MIN_PX = 320;
const LABELS_PX = 192;
const SCOPED_PX = 112;
const STATUS_PX = 80;
const ASSIGNEE_PX = 80;
const COUNT_PX = 64;

const NAME_COL = "flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;";
const LABELS_COL = `flex:0 0 ${LABELS_PX}px;box-sizing:border-box;padding:0 8px;display:flex;flex-wrap:wrap;gap:4px;`;
const SCOPED_COL = `flex:0 0 ${SCOPED_PX}px;box-sizing:border-box;padding:0 8px;display:flex;flex-wrap:wrap;gap:4px;`;
const STATUS_COL = `flex:0 0 ${STATUS_PX}px;text-align:center;font-size:12px;`;
const ASSIGNEE_COL = `flex:0 0 ${ASSIGNEE_PX}px;text-align:center;font-size:12px;color:${MUTED};`;
const COUNT_COL = `flex:0 0 ${COUNT_PX}px;text-align:center;font-size:12px;color:${MUTED};`;
const ROW_BOX = `border-bottom:1px solid ${BORDER};padding-top:6px;padding-bottom:6px;font-size:14px;`;
// Every row is a list item with a disclosure marker so columns line up; non-expandable
// rows get a transparent marker of the same width.
const MARKER_LINE = "display:list-item;list-style-position:inside;";
const HIDDEN_MARKER = "list-style-type:disclosure-closed;color:transparent;";
const CELLS = `display:inline-flex;align-items:center;width:calc(100% - ${MARKER_PX}px);vertical-align:middle;`;
const LINK = `color:${FG};text-decoration:none;`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(label: string): string {
  const { bg, fg } = labelColors(label);
  return `<span style="display:inline-block;border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:500;line-height:1.25;background-color:${bg};color:${fg};">${esc(label)}</span>`;
}

function statusPill(state: string): string {
  const open = state === "opened";
  const style = open
    ? "background-color:rgba(34,197,94,0.15);color:#15803d;"
    : "background-color:rgba(59,130,246,0.15);color:#1d4ed8;";
  return `<span style="display:inline-block;border-radius:9999px;padding:2px 8px;${style}">${esc(state)}</span>`;
}

function snippet(s: SearchSnippet | null): string {
  if (!s) return "";
  return `<div style="font-size:12px;color:${MUTED};">${esc(s.before)}<mark style="background-color:#fef08a;color:${FG};">${esc(s.match)}</mark>${esc(s.after)}</div>`;
}

/** Labels + scoped label columns, mirroring RowLabels.svelte. */
function labelCells(labels: string[], scopedKeys: string[]): string {
  const nonScoped: string[] = [];
  const scoped: Record<string, string[]> = {};
  for (const label of labels) {
    const idx = label.indexOf("::");
    const key = idx === -1 ? null : label.substring(0, idx);
    if (key !== null) (scoped[key] ??= []).push(label.substring(idx + 2));
    if (key === null || !scopedKeys.includes(key)) nonScoped.push(label);
  }
  let html = `<div style="${LABELS_COL}">${nonScoped.map(badge).join("")}</div>`;
  for (const key of scopedKeys) {
    html += `<div style="${SCOPED_COL}">${(scoped[key] ?? []).map(badge).join("")}</div>`;
  }
  return html;
}

function emptyLabelCells(scopedKeys: string[]): string {
  return `<div style="${LABELS_COL}"></div>` + scopedKeys.map(() => `<div style="${SCOPED_COL}"></div>`).join("");
}

/** Expandable row: <details> with the row content as <summary>, open if expanded in the app. */
function collapsible(key: string, depth: number, extraStyle: string, cells: string, children: string): string {
  const open = filterStore.expandedKeys.has(key) ? " open" : "";
  return (
    `<details${open} style="margin:0;">` +
    `<summary style="${MARKER_LINE}${ROW_BOX}${extraStyle}padding-left:${depth * INDENT_PX}px;cursor:pointer;">` +
    `<div style="${CELLS}">${cells}</div>` +
    `</summary>${children}</details>`
  );
}

function issueRow(issue: GitLabIssue, depth: number, scopedKeys: string[]): string {
  const dot = issue.state === "opened" ? "#22c55e" : "#3b82f6";
  const assignees = issue.assignees.length > 0 ? String(issue.assignees.length) : "";
  return (
    `<div style="${MARKER_LINE}${HIDDEN_MARKER}${ROW_BOX}padding-left:${depth * INDENT_PX}px;">` +
    `<div style="${CELLS}color:${FG};">` +
    `<div style="${NAME_COL}">` +
    `<span style="display:inline-block;width:8px;height:8px;flex-shrink:0;border-radius:9999px;background-color:${dot};"></span>` +
    `<div style="min-width:0;flex:1 1 auto;">` +
    `<a href="${esc(issue.web_url)}" target="_blank" rel="noopener noreferrer" style="${LINK}"><span style="color:${MUTED};">#${issue.iid}</span> ${esc(issue.title)}</a>` +
    snippet(filterStore.getIssueSearchSnippet(issue)) +
    `</div></div>` +
    labelCells(issue.labels, scopedKeys) +
    `<div style="${STATUS_COL}">${statusPill(issue.state)}</div>` +
    `<div style="${ASSIGNEE_COL}">${assignees}</div>` +
    `<div style="${COUNT_COL}"></div>` +
    `</div></div>`
  );
}

function epicRow(te: TreeEpic, projectId: number, depth: number, scopedKeys: string[]): string {
  const epic = te.epic;
  const key = epic ? `epic-${epic.group_id}-${epic.iid}` : `no-epic-${projectId}`;
  const name = epic
    ? `<div style="min-width:0;flex:1 1 auto;">` +
      `<a href="${esc(epic.web_url)}" target="_blank" rel="noopener noreferrer" style="${LINK}"><span style="color:${MUTED};">&amp;${epic.iid}</span> ${esc(epic.title)}</a>` +
      snippet(filterStore.getEpicSearchSnippet(epic)) +
      `</div>`
    : `<span style="font-style:italic;color:${MUTED};">No Epic</span>`;
  const cells =
    `<div style="${NAME_COL}">${name}</div>` +
    labelCells(epic?.labels ?? [], scopedKeys) +
    `<div style="${STATUS_COL}">${epic ? statusPill(epic.state) : ""}</div>` +
    `<div style="${ASSIGNEE_COL}"></div>` +
    `<div style="${COUNT_COL}">${te.issues.length}</div>`;
  const children = te.issues.map((i) => issueRow(i, depth + 1, scopedKeys)).join("");
  return collapsible(key, depth, "", cells, children);
}

function containerCells(name: string, count: number, scopedKeys: string[]): string {
  return (
    `<div style="${NAME_COL}">${esc(name)}</div>` +
    emptyLabelCells(scopedKeys) +
    `<div style="${STATUS_COL}"></div>` +
    `<div style="${ASSIGNEE_COL}"></div>` +
    `<div style="${COUNT_COL}">${count}</div>`
  );
}

function projectRow(tp: TreeProject, depth: number, scopedKeys: string[]): string {
  const count = tp.epics.reduce((sum, e) => sum + e.issues.length, 0);
  const children = tp.epics.map((te) => epicRow(te, tp.project.id, depth + 1, scopedKeys)).join("");
  return collapsible(`project-${tp.project.id}`, depth, "font-weight:500;", containerCells(tp.project.name, count, scopedKeys), children);
}

function groupRow(tg: TreeGroup, depth: number, scopedKeys: string[]): string {
  const children =
    tg.subgroups.map((sg) => groupRow(sg, depth + 1, scopedKeys)).join("") +
    tg.projects.map((tp) => projectRow(tp, depth + 1, scopedKeys)).join("");
  return collapsible(`group-${tg.group.id}`, depth, "font-weight:600;", containerCells(tg.group.name, countIssues(tg), scopedKeys), children);
}

/** Depth of the deepest issue row below a group at the given depth. */
function maxIssueDepth(tg: TreeGroup, depth: number): number {
  let max = tg.projects.length > 0 ? depth + 3 : depth;
  for (const sg of tg.subgroups) max = Math.max(max, maxIssueDepth(sg, depth + 1));
  return max;
}

/**
 * Render the table as currently shown (filters, sort, scoped columns, expanded rows)
 * into a self-contained static HTML snippet with inline styles and no scripts.
 */
export function buildExportHtml(): string {
  const scopedKeys = filterStore.activeScopedKeys;
  const head = `font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.025em;color:${MUTED};`;
  const header =
    `<div style="${MARKER_LINE}${HIDDEN_MARKER}border-bottom:2px solid ${BORDER};padding:8px 0;font-size:14px;">` +
    `<div style="${CELLS}${head}">` +
    `<div style="flex:1 1 auto;min-width:0;">Name</div>` +
    `<div style="${LABELS_COL}">Labels</div>` +
    scopedKeys.map((k) => `<div style="${SCOPED_COL}">${esc(k)}</div>`).join("") +
    `<div style="${STATUS_COL}">Status</div>` +
    `<div style="${ASSIGNEE_COL}">Assignees</div>` +
    `<div style="${COUNT_COL}">Count</div>` +
    `</div></div>`;
  const rows = filterStore.filteredTree.map((tg) => groupRow(tg, 0, scopedKeys)).join("");
  // Fixed columns can't shrink, so narrow hosts (e.g. a Confluence page) would squeeze the
  // name column to nothing. Reserve room for the deepest indentation and scroll instead.
  const depth = Math.max(0, ...filterStore.filteredTree.map((tg) => maxIssueDepth(tg, 0)));
  const minWidth =
    depth * INDENT_PX + MARKER_PX + NAME_MIN_PX + LABELS_PX + scopedKeys.length * SCOPED_PX + STATUS_PX + ASSIGNEE_PX + COUNT_PX;
  return (
    `<div style="overflow-x:auto;">` +
    `<div style="min-width:${minWidth}px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${FG};background-color:#ffffff;line-height:1.4;">${header}${rows}</div>` +
    `</div>`
  );
}
