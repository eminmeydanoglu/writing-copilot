# writing-copilot

`writing-copilot` is an Obsidian plugin for reviewing a sibling shadow file next to a Markdown note.

## How It Works

- canonical note: `x.md`
- agent working copy: `x.shadow`
- review command: `Toggle Diff Review Mode`

Open `x.md` in Obsidian, keep `x.shadow` in the same folder, then run the command. The plugin opens a split diff review surface, keeps both sides editable, highlights pending changes, and lets you approve or reject the selected change.

## Repo Layout

- `src/`: plugin runtime and review logic
- `tests/`: unit tests
- `skills/`: local writing-copilot skill material
- `writings/styles/`: shared style references for writing projects
- `archive/app/`: archived web prototype kept only as reference

## Install

1. Run `npm install`
2. Run `npm run build`
3. Create `<vault>/.obsidian/plugins/writing-copilot/`
4. Copy `manifest.json` and `styles.css` into that folder
5. Copy the built `main.js` into that folder
6. Enable `Writing Copilot` in Obsidian community plugins

## Develop

- `npm run dev`: watch and rebuild `main.js`
- `npm run typecheck`
- `npm test`
