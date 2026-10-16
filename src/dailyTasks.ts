/**
 * Daily tasks are stored in their day's note, as a `## Tasks` section at the top of the file:
 *
 *     ## Tasks
 *     - [ ] Write the report ➕ 2026-10-10 [carried:: 3] !high
 *     - [x] Call the bank ➕ 2026-10-16 ✅ 2026-10-16
 *
 * Open tasks sit in the note of the day they are on (rollover moves them), done tasks in the note
 * of the day they were done. `➕`/`✅` dates follow the Obsidian Tasks plugin, `[carried:: n]` is a
 * Dataview field.
 */
import { splitBlocks } from './markdown';
import { setNoteTaskPri, splitPriMark, uid, type DailyTask } from './vault';

export const TASKS_HEADING = '## Tasks';

const TASK_LINE = /^- \[([ xX])\] ?(.*)$/;
const SUFFIX = /\s*(?:➕ (\d{4}-\d{2}-\d{2})|✅ (\d{4}-\d{2}-\d{2})|\[carried:: (\d+)\])\s*$/u;

function parseTask(line: string, date: string): DailyTask | null {
  const m = line.match(TASK_LINE);
  if (!m) return null;
  let rest = m[2], created: string | undefined, done: string | undefined, carried = 0;
  let { text, pri } = splitPriMark(rest);
  rest = text;
  for (let s: RegExpMatchArray | null; (s = rest.match(SUFFIX)) && s.index! > 0; rest = rest.slice(0, s.index)) {
    if (s[1]) created ??= s[1]; else if (s[2]) done ??= s[2]; else carried = +s[3];
  }
  // The priority mark goes last, but files edited elsewhere may have it before the dates.
  if (!pri) ({ text: rest, pri } = splitPriMark(rest));
  const isDone = m[1] !== ' ';
  return {
    id: uid(), title: rest.trim(), pri: pri ?? 'm', createdOn: created ?? date, carried, day: date,
    ...(isDone ? { done: true, doneOn: done ?? date } : {}),
  };
}

function taskLine(t: DailyTask): string {
  let s = `- [${t.done ? 'x' : ' '}] ${t.title} ➕ ${t.createdOn}`;
  if (t.carried) s += ` [carried:: ${t.carried}]`;
  if (t.done && t.doneOn) s += ` ✅ ${t.doneOn}`;
  return setNoteTaskPri(s, t.pri);
}

/** Splits a daily note's file into its tasks and the note body the editor shows. */
export function parseDailyFile(content: string, date: string): { tasks: DailyTask[]; body: string[] } {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0].trim() !== TASKS_HEADING) return { tasks: [], body: splitBlocks(content) };
  const tasks: DailyTask[] = [];
  let i = 1;
  for (let t: DailyTask | null; i < lines.length && (t = parseTask(lines[i], date)); i++) if (t.title) tasks.push(t);
  if (i < lines.length && lines[i].trim() === '') i++;
  return { tasks, body: splitBlocks(lines.slice(i).join('\n')) };
}

/** A daily note's file contents: its tasks section (if it has tasks), then the body. */
export function dailyFileText(tasks: DailyTask[], body: string[]): string {
  if (!tasks.length) return body.join('\n');
  return [TASKS_HEADING, ...tasks.map(taskLine), '', ...body].join('\n');
}

/** The day whose note holds a task. */
export const taskDay = (t: DailyTask) => (t.done && t.doneOn ? t.doneOn : t.day);
