# journal

A local-first Markdown journal for daily notes and a todo list. Desktop app for Linux and Windows, built with Electron.

- **Daily note**: one note per day, with a task list at the top. Unchecked tasks carry over to the next day on their own, and each task shows its age and carry-over count.
- **Notes**: Markdown with live preview. Click a line to edit its raw Markdown. Supports headings, lists, `- [ ]` checkboxes, quotes, fenced code with highlighting, tables, `[[wiki links]]`, and images and files as attachments.
- **All open tasks**: daily tasks plus every `- [ ]` line from your other notes. You can group, filter and sort them. Add `!high` or `!low` to the end of a note task to set its priority.

## Your vault

Everything lives in one folder, by default `~/Documents/Journal`. You can change it in **Settings → Vault → Change…**.

```
Journal/2026/10/16.10.2026.md   daily notes
Projects/Example project.md     notes, in folders or at the top level
Projects/Attachments/           files pasted or dropped into notes in Projects/
.journal/state.json             daily tasks, settings, open tabs
```

Daily notes are placed like in Obsidian's Daily notes plugin: a folder plus a date format with the same tokens (`YYYY`, `MM`, `DD`, `MMMM`, `Do`, `[text]`…), where `/` makes subfolders. The default is folder `Journal` with format `YYYY/MM/DD.MM.YYYY`. Change both in **Settings → Daily notes**; existing daily notes are moved to match. When you open an Obsidian vault for the first time, its `.obsidian/daily-notes.json` settings are used.

A daily note file is created for each day automatically, when the app starts and at midnight. To create notes and folders, use the buttons next to **Files / Daily notes** in the sidebar, or hover over a folder to create something inside it.

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
npm run dist:win     # release/Journal Setup <version>.exe
```

Build the Windows installer on Windows. On Linux, electron-builder needs Wine to finish the `.exe`.

## Keyboard

| Where | Key | Action |
|---|---|---|
| Focused task | Space / x | complete |
| Focused task | 1 / 2 / 3 | high / medium / low priority |
| Focused task | p | priority menu |
| Focused task | Delete / Backspace | remove (daily tasks) |
| Focused task | ↑ / ↓ | move between tasks |
| Editor | Enter | new line, continuing lists and checkboxes |
| Editor | Esc | stop editing |
