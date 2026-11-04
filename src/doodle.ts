/**
 * The sidebar's background: a repeating tile of small line icons (office work, code, notes), all
 * drawn on the same 24-unit grid at the same size and evenly spaced. It's used as a CSS mask, so
 * its colour comes from the theme; the stylesheet turns the whole pattern a little.
 */

/** Icon outlines on a 24×24 grid. */
const ICONS: string[] = [
  // pencil
  'M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8zM13.5 7l3.5 3.5',
  // paperclip
  'M16.5 7.5l-7 7a2.4 2.4 0 0 0 3.4 3.4l7-7a4.4 4.4 0 0 0-6.2-6.2l-7 7a6.4 6.4 0 0 0 9 9l5-5',
  // coffee mug
  'M4.5 9.5h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM15.5 11.5h1.3a2.6 2.6 0 0 1 0 5.2h-1.6M8.5 3.5c-1.2 1.4 1.2 2.4 0 4M12 3.5c-1.2 1.4 1.2 2.4 0 4',
  // laptop
  'M5.5 6h13a1 1 0 0 1 1 1v8.5h-15V7a1 1 0 0 1 1-1zM2.5 15.5h19l-1.2 2.2a1.5 1.5 0 0 1-1.3.8H5a1.5 1.5 0 0 1-1.3-.8z',
  // code brackets
  'M8 7l-5 5 5 5M16 7l5 5-5 5M13.6 4.5l-3.2 15',
  // git branch
  'M6.5 6.5v11M6.5 14.5c0-4.5 11-2.5 11-6M8.5 4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM8.5 19.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM19.5 6.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z',
  // terminal
  'M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5zM7 9.5l3 2.5-3 2.5M12.5 15h4.5',
  // notebook
  'M7 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3zM9.5 3v18M12.5 8h4M12.5 11h4M4 7h3M4 12h3M4 17h3',
  // sticky note
  'M5 4h14a1 1 0 0 1 1 1v9l-6 6H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 20v-5a1 1 0 0 1 1-1h5M8 9h8M8 12.5h5',
  // calendar
  'M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h2M14 14h2M8 17h2',
  // light bulb
  'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.6v.3h5v-.3c0-1 .5-1.9 1.3-2.6A6 6 0 0 0 12 3z',
  // checklist
  'M3.5 6.5l1.8 1.8L8.5 5M11.5 7h9M3.5 13.5l1.8 1.8 3.2-3.3M11.5 14h9M4 19.5h3M11.5 20h9',
  // envelope
  'M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM3.5 6.5l8.5 6.5 8.5-6.5',
  // bug
  'M8 10a4 4 0 0 1 8 0v4.5a4 4 0 0 1-8 0zM12 10v8.5M8 12.5H4.5M16 12.5h3.5M8.3 16.5l-3 2M15.7 16.5l3 2M8.5 8.5l-3-2M15.5 8.5l3-2M10 6.5L9 4M14 6.5L15 4',
  // folder
  'M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z',
  // clock
  'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM12 7v5.2l3.3 2',
];

/** Distance between neighbouring icons, and each icon's size, in CSS pixels. */
const PITCH = 60, ICON = 22, COLS = 4, ROWS = 4;
/**
 * Every other row is shifted by half a step, and rows are √3/2 of a step apart, so each icon is
 * the same distance from all six neighbours.
 */
const ROW = PITCH * Math.sqrt(3) / 2;
/** Size of one tile; ROWS is even, so the shifted rows line up from tile to tile. */
export const DOODLE_W = PITCH * COLS, DOODLE_H = ROW * ROWS;

function tile(): string {
  const s = ICON / 24;
  const parts = ICONS.slice(0, COLS * ROWS).map((d, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = (col + 0.5 + (row % 2) / 2) * PITCH, y = (row + 0.5) * ROW;
    const icon = (cx: number) => `<path transform="translate(${(cx - ICON / 2).toFixed(2)} ${(y - ICON / 2).toFixed(2)}) scale(${s})" d="${d}"/>`;
    // The shifted row's last icon sits on the tile's edge: draw it on both sides so tiles join up.
    return x + ICON / 2 > DOODLE_W ? icon(x) + icon(x - DOODLE_W) : icon(x);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DOODLE_W}" height="${DOODLE_H.toFixed(3)}" viewBox="0 0 ${DOODLE_W} ${DOODLE_H.toFixed(3)}" fill="none" stroke="#000" stroke-width="${(1.5 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</svg>`;
}

/** The tile as a CSS `url(...)`. */
export const DOODLE_URL = `url("data:image/svg+xml,${encodeURIComponent(tile())}")`;
