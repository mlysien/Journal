export const Check = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--on-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.3 5.2l1.8 1.8 3.6-3.9" /></svg>
);
export const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7 2.5v9M2.5 7h9" /></svg>
);
export const Close = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" /></svg>
);
export const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3l3 3-3 3" /></svg>
);
export const ChevronLeft = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 3l-3 3 3 3" /></svg>
);
export const SidebarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M6 3v10" /></svg>
);
export const CalendarIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" /></svg>
);
export const ListIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7M2.8 4.5h.4M2.8 8h.4M2.8 11.5h.4" /></svg>
);
export const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></svg>
);
export const NotePlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6L9 2z" /><path d="M9 2v4h4M8 8.5v3.5M6.25 10.25h3.5" /></svg>
);
export const FolderPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.6h4.8A1.5 1.5 0 0 1 14 6.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z" /><path d="M8 7.2v3.6M6.2 9h3.6" /></svg>
);

/* Sidebar tree icons, 16px. */
const tree = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const FolderIcon = () => (
  <svg {...tree}><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.6h4.8A1.5 1.5 0 0 1 14 6.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z" /></svg>
);
export const FolderOpenIcon = () => (
  <svg {...tree}><path d="M2 11.5v-7A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.6h4.3A1.5 1.5 0 0 1 13.5 6.1V7" /><path d="M2 11.5 3.6 7.9A1.5 1.5 0 0 1 5 7h8.6a.9.9 0 0 1 .8 1.3l-1.6 3.9a1.5 1.5 0 0 1-1.4.8H3.5A1.5 1.5 0 0 1 2 11.5z" /></svg>
);
export const FileIcon = () => (
  <svg {...tree}><path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6L9 2z" /><path d="M9 2v4h4M5.8 9h4.4M5.8 11.2h3" /></svg>
);
export const DayIcon = () => (
  <svg {...tree}><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" /><path d="M5.6 9.2h.01M8 9.2h.01M10.4 9.2h.01M5.6 11.3h.01M8 11.3h.01" strokeWidth="1.8" /></svg>
);
/** A notebook with a ribbon bookmark, for the Journal folder. */
export const JournalIcon = () => (
  <svg {...tree}><path d="M4 2h7.5A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" /><path d="M5.5 2v12" /><path d="M8.5 2v4.5l1.25-1 1.25 1V2" /></svg>
);

export const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" /></svg>
);
export const CheckSmall = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
);
export const PaperclipIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.2 7.6 8 12.8a3.4 3.4 0 0 1-4.8-4.8l5.6-5.6a2.27 2.27 0 0 1 3.2 3.2L6.4 11.2a1.13 1.13 0 0 1-1.6-1.6l4.9-4.9" /></svg>
);
export const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V5.5A1.5 1.5 0 0 1 4 4h2.5" /></svg>
);
