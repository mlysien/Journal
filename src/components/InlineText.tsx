import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { inlineToks, type InlineTok } from '../markdown';
import { CheckSmall, CopyIcon, PaperclipIcon } from './icons';
import { useAssets } from '../assets';

/** A file in the vault, shown with a paperclip; click opens it in its default app. */
export function AttachmentChip({ label, target, wiki }: { label: string; target: string; wiki: boolean }) {
  const assets = useAssets();
  const rel = assets.resolve(target, wiki);
  return (
    <span data-link="1" className={'attachment' + (rel ? '' : ' missing')} title={rel ? `Open ${rel}` : `Not found in the vault: ${target}`}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
      onClick={e => { e.stopPropagation(); if (rel) assets.open(rel); }}>
      <PaperclipIcon />{label}
    </span>
  );
}

/** Inline `code` with a copy button that appears on hover. */
function CodeChip({ text, style }: { text: string; style: CSSProperties }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <span className={'code-chip' + (copied ? ' copied' : '')} style={style}>
      {text}
      <button data-link="1" className="code-copy" title={copied ? 'Copied' : 'Copy'} aria-label="Copy to clipboard"
        // mousedown would otherwise start editing the line
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
        onClick={e => { e.stopPropagation(); window.journal.copyText(text).then(() => setCopied(true)).catch(() => {}); }}>
        {copied ? <CheckSmall /> : <CopyIcon />}
      </button>
    </span>
  );
}

/** Inline Markdown (bold, code, links) with clickable links. Web links open in the browser. */
export function InlineText({ text, onOpenLink }: { text: string; onOpenLink?: (name: string) => void }) {
  const click = (e: MouseEvent, tk: InlineTok) => {
    e.stopPropagation();
    if (tk.link) onOpenLink?.(tk.link);
    else if (tk.href) window.journal.openExternal(tk.href);
  };
  return (
    <>
      {inlineToks(text).map(tk => {
        if (tk.code) return <CodeChip key={tk.key} text={tk.text} style={tk.style} />;
        if (tk.attachment) return <AttachmentChip key={tk.key} label={tk.text} target={tk.attachment} wiki={!!tk.wiki} />;
        const live = !!tk.href || (!!tk.link && !!onOpenLink);
        return <span key={tk.key} data-link={live ? '1' : undefined} onClick={live ? e => click(e, tk) : undefined} title={tk.href} style={tk.style}>{tk.text}</span>;
      })}
    </>
  );
}
