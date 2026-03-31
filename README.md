# writing-copilot

`writing-copilot` is now an Obsidian plugin for reviewing sibling shadow files next to a Markdown note.

Current review model:

- canonical note: `x.md`
- agent working copy: `x.shadow`
- review surface: split-screen diff review mode inside native Obsidian editors
- archived web prototype: `archive/app/`

Main command:

- `Toggle Diff Review Mode`

Use it while `x.md` is open and `x.shadow` exists in the same folder. The plugin will:

- split the editor into draft and suggestion views
- keep both sides editable
- highlight pending changes live
- let you step through them with `Previous` / `Next`
- apply `Approve` / `Reject` on the selected change

Project contract docs:

- `SPEC.md`
- `ARCHITECTURE.md`
- `WORKFLOW.md`
