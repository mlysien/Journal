# journal

A local-first Markdown journal for daily notes and a todo list. Desktop app for Linux and Windows, built with Electron.

- **Daily note**: one note per day, with a task list at the top. Unchecked tasks carry over to the next day on their own, and each task shows its age and carry-over count.
- **Notes**: Markdown with live preview. Click a line to edit its raw Markdown. Supports headings, lists, `- [ ]` checkboxes, quotes, fenced code with highlighting, tables, `[[wiki links]]`, and images and files as attachments.
- **Checklists in notes**: `- [ ]` lines work in any note. Add `!high` or `!low` to the end of one to mark its priority.

## Your vault

Everything lives in one folder, by default `~/Documents/Journal`. You can change it in **Settings → Vault → Change…**.

```
Journal/2026/10/16.10.2026.md   daily notes
Projects/Example project.md     notes, in folders or at the top level
Projects/Attachments/           files pasted or dropped into notes in Projects/
.journal/state.json             settings, open tabs
```

Each day's tasks are saved in that day's note, in a `## Tasks` section at the top:

```markdown
## Tasks
- [ ] Write the report ➕ 2026-10-10 [carried:: 3] !high
- [x] Call the bank ➕ 2026-10-16 ✅ 2026-10-16
```

`➕` is the day a task was created and `✅` the day it was done (the Obsidian Tasks plugin's format), `[carried:: n]` how many times it moved to a new day, and `!high` / `!low` its priority. Open tasks move into today's note when the day starts; done tasks stay in the note of the day they were done. Vaults from older versions, which kept tasks in `.journal/state.json`, are converted on the first start.

Daily notes are placed like in Obsidian's Daily notes plugin: a folder plus a date format with the same tokens (`YYYY`, `MM`, `DD`, `MMMM`, `Do`, `[text]`…), where `/` makes subfolders. The default is folder `Journal` with format `YYYY/MM/DD.MM.YYYY`. Change both in **Settings → Daily notes**; existing daily notes are moved to match. When you open an Obsidian vault for the first time, its `.obsidian/daily-notes.json` settings are used.

A daily note file is created for each day automatically, when the app starts and at midnight, and today's note becomes the open tab. To create notes and folders, use the buttons next to **Files / Daily notes** in the sidebar, or hover over a folder to create something inside it. Right-click a note or folder to give it an icon and colour, or to move it to the trash. Drag folders to change their order; it's kept in `.journal/state.json`.

Paste or drag files into a note (screenshots, images, PDFs, files copied in your file manager) and they're saved in an `Attachments` folder next to the note and linked with a relative Markdown link. Images show inline; other files show as a paperclip chip that opens the file. Obsidian embeds like `![[image.png]]` are found by name anywhere in the vault.

Notes are plain Markdown, so you can edit them in any other editor or sync the folder however you like. The app reads the folder when it starts, so restart it to pick up changes made elsewhere.

## Development

```sh
npm install
npm run dev          # opens the app with hot reload (F12 toggles DevTools)
npm run build        # typecheck, then build the renderer and Electron scripts
npm start            # run the built app
```

Set `JOURNAL_VAULT=/some/folder` to open a different vault without touching your settings.

## Packaging

```sh
npm run dist:linux   # release/Journal-<version>.AppImage and release/journal_<version>_amd64.deb
npm run dist:win     # release/Journal-Setup-<version>.exe
```

Build the Windows installer on Windows. On Linux, electron-builder needs Wine to finish the `.exe`.

## Releases and updates

Push a tag like `v0.2.0` and GitHub Actions builds the packages and publishes a GitHub release (`.github/workflows/release.yml`). The version comes from the tag.

Installed apps check the latest release 10 seconds after starting and every 4 hours after that. The Windows installer and the AppImage download a new version in the background and install it when the app is closed, or right away with **Restart now** in the banner or in **Settings → System**. A `.deb` install can't replace itself, so it shows a banner with a link to the release instead.

Updates are found through the `latest.yml` and `latest-linux.yml` files in the release, so keep them among its files. Releases marked as drafts or pre-releases are skipped.

## Pomodoro timer

Hover over one of today's tasks and click the tomato to start a 25-minute pomodoro for it. The countdown shows on the task and in the status bar, from any tab, with pause and stop buttons. When it ends, a bell plays, a notification appears, and a 5-minute break starts; every fourth break is 15 minutes. After a break, the next pomodoro waits on the task until you click it. On Windows the taskbar button shows the progress. Change the lengths, or turn off the bell, in **Settings → Pomodoro**. The timer isn't saved: closing the app stops it.

## Keyboard

| Where | Key | Action |
|---|---|---|
| Focused task | Space / x | complete |
| Focused task | 1 / 2 / 3 | high / medium / low priority |
| Focused task | p | priority menu |
| Focused task | Delete / Backspace | remove (daily tasks) |
| Focused task | ↑ / ↓ | move between tasks |
| Focused task | T | start a pomodoro, or pause / resume it |
| Editor | Enter | new line, continuing lists and checkboxes |
| Editor | Backspace at the start of a bullet | turn it back into a plain line |
| Editor | Shift+↑ / ↓, Shift+click | select whole lines, then copy, cut, delete or type over them |
| Editor | Esc | stop editing |
| Note title | Enter | start writing the note |
| Anywhere | Ctrl+D | open today's daily note |
| Anywhere | Ctrl+K | search |
| Anywhere | Ctrl+N | new note |
| Anywhere | Ctrl+W / Ctrl+Shift+T | close tab / reopen the last closed tab |
| Anywhere | Ctrl+\\ | show or hide the sidebar |

The shortcuts under **Anywhere** can be changed in **Settings → Keyboard shortcuts**. **Settings → System → Start at login** opens Journal when you sign in (an autostart entry in `~/.config/autostart` on Linux, a login item on Windows).
