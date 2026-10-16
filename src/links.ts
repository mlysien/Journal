/** Turning pasted URLs into Markdown links. */

/** The whole string is one http(s) URL. */
export const isUrl = (s: string) => /^https?:\/\/[^\s<>"]+$/i.test(s);

/**
 * A short readable label for a URL, used until (or instead of) the page title. Issue trackers
 * get their usual references, since their pages need a login the app doesn't have:
 * Jira `PROJ-123`, GitLab `project!42` / `project#42`, GitHub `repo#42`.
 */
export function urlLabel(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  const p = u.pathname;
  let m: RegExpMatchArray | null;
  const issueKey = u.searchParams.get('selectedIssue') ?? u.searchParams.get('issueKey');
  if ((m = p.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i))) return m[1].toUpperCase();
  if (issueKey && /^[A-Z][A-Z0-9_]+-\d+$/i.test(issueKey)) return issueKey.toUpperCase();
  if ((m = p.match(/\/([^/]+)\/-\/(merge_requests|issues|work_items|pipelines|commit|tree|blob)\/([^/?#]+)/))) {
    const [, project, kind, id] = m;
    const sep = kind === 'merge_requests' ? '!' : kind === 'issues' || kind === 'work_items' ? '#' : kind === 'pipelines' ? ' pipeline ' : kind === 'commit' ? '@' : ':';
    return project + sep + (kind === 'commit' ? id.slice(0, 8) : decodeURIComponent(id));
  }
  if (u.hostname === 'github.com' && (m = p.match(/^\/[^/]+\/([^/]+)\/(pull|issues)\/(\d+)/))) return `${m[1]}#${m[3]}`;
  const label = (u.hostname.replace(/^www\./, '') + p.replace(/\/+$/, '')).replace(/%20/g, ' ');
  return label.length > 60 ? label.slice(0, 57) + '…' : label;
}

/** Characters that would break `[label](url)` syntax. */
const escapeLabel = (s: string) => s.replace(/[[\]]/g, m => '\\' + m).replace(/\s+/g, ' ').trim();
const escapeUrl = (s: string) => s.replace(/[()]/g, m => (m === '(' ? '%28' : '%29'));

export const mdLink = (label: string, url: string) => `[${escapeLabel(label)}](${escapeUrl(url)})`;

/** Pasting raw is right when the caret sits inside link syntax that is already being typed. */
export const insideLinkSyntax = (before: string) => /\]\($/.test(before) || /<$/.test(before);

/**
 * Paste `url` into a text field as a Markdown link. Selected text becomes the label; otherwise a
 * label from the URL goes in at once and `apply(draft, final)` later swaps in the page title.
 * Returns false if nothing was inserted, so the caller can let the normal paste happen.
 */
export function pasteUrl(el: HTMLInputElement | HTMLTextAreaElement, url: string, apply: (draft: string, final: string) => void): boolean {
  const selected = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0).trim();
  const draft = mdLink(selected || urlLabel(url), url);
  // insertText keeps the undo history and caret, and fires onChange like typing would.
  if (!document.execCommand('insertText', false, draft)) return false;
  if (selected) return true;
  window.journal.fetchTitle(url).then(title => {
    if (!title) return;
    const final = mdLink(title, url), delta = final.length - draft.length;
    const focused = document.activeElement === el;
    const at = el.value.indexOf(draft), sel = [el.selectionStart ?? 0, el.selectionEnd ?? 0];
    apply(draft, final);
    // Keep the caret where it was if the user is still typing there.
    if (focused && at >= 0) requestAnimationFrame(() => {
      const shift = (p: number) => (p > at ? p + delta : p);
      el.setSelectionRange(shift(sel[0]), shift(sel[1]));
    });
  });
  return true;
}
