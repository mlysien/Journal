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
/** Two chevrons pointing in: collapse all. */
export const CollapseAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2.5 8 5.5l3-3M5 13.5l3-3 3 3" /></svg>
);
/** Two chevrons pointing out: expand all. */
export const ExpandAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5.5 8 2.5l3 3M5 10.5l3 3 3-3" /></svg>
);
export const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="4.5" /><path d="m10.4 10.4 3.1 3.1" /></svg>
);

/** Icons a folder or note can be given in the sidebar, drawn on the same 16px grid as the tree icons. */
export const PICKABLE: Record<string, JSX.Element> = {
  folder: <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.6h4.8A1.5 1.5 0 0 1 14 6.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z" />,
  file: <><path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6L9 2z" /><path d="M9 2v4h4M5.8 9h4.4M5.8 11.2h3" /></>,
  journal: <><path d="M4 2h7.5A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" /><path d="M5.5 2v12" /><path d="M8.5 2v4.5l1.25-1 1.25 1V2" /></>,
  star: <path d="M8 2.26l1.86 3.83 4.14 0.62 -3 2.9 0.72 4.14L8 11.78l-3.72 1.97 0.72 -4.14 -3 -2.9 4.14 -0.62L8 2.26z" />,
  heart: <path d="M8 13.62S2.11 10.3 2.11 6.12A3 3 0 0 1 8 4.62a3 3 0 0 1 5.89 1.5c0 4.18 -5.89 7.5 -5.89 7.5z" />,
  bookmark: <path d="M4.18 2h7.64v12L8 11.27l-3.82 2.73v-12z" />,
  flag: <path d="M3.83 14V2M3.83 2.52h8.35l-1.88 3.13 1.88 3.13h-8.35" />,
  tag: <><path d="M2 2h5.78l6.22 6.22 -5.78 5.78 -6.22 -6.22V2z" /><circle cx="5.27" cy="5.27" r="1.09" /></>,
  briefcase: <><rect x="2" y="5" width="12" height="8.5" rx="1.5" /><path d="M5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M2 9h12" /></>,
  home: <path d="M2 7.45 8 2.55l6 4.91M3.64 6.36V13.45h3.27V9.64h2.18V13.45h3.27V6.36" />,
  user: <><circle cx="8" cy="4.86" r="2.86" /><path d="M2.29 14a5.71 5.71 0 0 1 11.43 0" /></>,
  people: <><circle cx="6" cy="5.6" r="2.2" /><path d="M2 12.6a4 4 0 0 1 8 0M10.5 3.5a2.2 2.2 0 0 1 0 4.2M11.5 8.9A4 4 0 0 1 14 12.6" /></>,
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13" />,
  terminal: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M4.8 6.3 6.8 8l-2 1.7M8.5 10h2.7" /></>,
  bulb: <path d="M5.91 11.91h4.17M6.43 14h3.13M5.7 9.83C4.45 8.89 3.83 7.74 3.83 6.17a4.17 4.17 0 0 1 8.35 0c0 1.57 -0.63 2.71 -1.88 3.65 -0.31 0.31 -0.52 0.63 -0.52 1.04v0.52H6.23V10.87c0 -0.42 -0.21 -0.73 -0.52 -1.04z" />,
  bolt: <path d="M9 2 3.5 9H8l-1 5 5.5-7H8l1-5z" />,
  target: <><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.73" /></>,
  check: <><circle cx="8" cy="8" r="6" /><path d="m6 8.95 1.85 1.85 3.6 -3.93" /></>,
  calendar: <><rect x="2.26" y="3.57" width="11.48" height="10.43" rx="2.09" /><path d="M2.26 6.7h11.48M5.39 2v2.61M10.61 2v2.61" /></>,
  clock: <><circle cx="8" cy="8" r="6" /><path d="M8 4.73v3.49l2.18 1.42" /></>,
  globe: <><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c1.75 1.85 2.51 3.82 2.51 6S9.75 12.15 8 14C6.25 12.15 5.49 10.18 5.49 8S6.25 3.85 8 2z" /></>,
  music: <><path d="M5.88 12.41V3.38l7.43 -1.38V10.81" /><circle cx="4.28" cy="12.41" r="1.59" /><circle cx="11.72" cy="10.81" r="1.59" /></>,
  camera: <><path d="M2 5.75A1.5 1.5 0 0 1 3.5 4.25h1.6l1.2 -1.5h3.4L10.9 4.25h1.6A1.5 1.5 0 0 1 14 5.75v6a1.5 1.5 0 0 1 -1.5 1.5h-9A1.5 1.5 0 0 1 2 11.75v-6z" /><circle cx="8" cy="8.55" r="2.3" /></>,
  coffee: <path d="M2 6h9.14v4.57a3.43 3.43 0 0 1 -3.43 3.43H5.43a3.43 3.43 0 0 1 -3.43 -3.43V6zM11.14 7.14h1.14a1.71 1.71 0 0 1 0 3.43h-1.14M4.86 2v1.71M7.71 2v1.71" />,
  money: <><rect x="2" y="4" width="12" height="8" rx="1.5" /><circle cx="8" cy="8" r="1.8" /><path d="M4.5 6.5v3M11.5 6.5v3" /></>,
  archive: <><rect x="2" y="2.5" width="12" height="3" rx="1" /><path d="M3 5.5v6.5A1.5 1.5 0 0 0 4.5 13.5h7a1.5 1.5 0 0 0 1.5 -1.5V5.5M6.5 8h3" /></>,
  lock: <><rect x="3.09" y="6.91" width="9.82" height="7.09" rx="1.64" /><path d="M5.27 6.91V4.73a2.73 2.73 0 0 1 5.45 0v2.18" /></>,
  plane: <path d="M14 2.25 2 7.25l4.5 1.8L8.3 13.75 14 2.25zM6.5 9.05 14 2.25" />,
};

/** Colours a custom icon can have. They read on both the light and dark theme. */
export const ICON_COLORS: Record<string, string> = {
  red: 'oklch(0.66 0.15 25)',
  orange: 'oklch(0.72 0.14 55)',
  yellow: 'oklch(0.80 0.13 90)',
  green: 'oklch(0.70 0.13 150)',
  teal: 'oklch(0.70 0.10 195)',
  blue: 'oklch(0.66 0.13 250)',
  violet: 'oklch(0.66 0.14 295)',
  pink: 'oklch(0.70 0.14 350)',
};

export const PickedIcon = ({ name }: { name: string }) => <svg {...tree}>{PICKABLE[name] ?? PICKABLE.file}</svg>;

export const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.6A1.5 1.5 0 0 0 6.2 14.5h3.6a1.5 1.5 0 0 0 1.5-1.4l.7-8.6" /></svg>
);
export const PaletteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2a6 6 0 0 0 0 12c.9 0 1.3-.6 1.3-1.2 0-.9-.8-1.2-.8-2 0-.7.5-1.1 1.2-1.1h1.6A2.7 2.7 0 0 0 14 6.9C14 4.2 11.3 2 8 2z" /><circle cx="5" cy="7" r=".6" /><circle cx="7.3" cy="4.7" r=".6" /><circle cx="10.4" cy="5" r=".6" /></svg>
);
export const TomatoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4.3c-2.8 0-4.8 1.7-4.8 4.2S4.3 12.6 7 12.6s4.8-1.6 4.8-4.1S9.8 4.3 7 4.3z" /><path d="M7 4.3V1.9M4.6 3.7L7 4.3l2.4-.6" /></svg>
);
export const CupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5.5h7.5v3.2a3 3 0 0 1-3 3h-1.5a3 3 0 0 1-3-3V5.5z" /><path d="M10 6.5h.8a1.6 1.6 0 0 1 0 3.2H10M5 1.8v1.6M7.5 1.8v1.6" /></svg>
);
export const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3.8 2.6v6.8a.5.5 0 0 0 .76.43l5.4-3.4a.5.5 0 0 0 0-.86l-5.4-3.4a.5.5 0 0 0-.76.43z" /></svg>
);
export const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="3" y="2.5" width="2.2" height="7" rx=".6" /><rect x="6.8" y="2.5" width="2.2" height="7" rx=".6" /></svg>
);
export const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="3" y="3" width="6" height="6" rx="1.2" /></svg>
);
