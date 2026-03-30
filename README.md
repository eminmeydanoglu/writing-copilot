# writing-copilot

`writing-copilot` is now an Obsidian plugin for reviewing shadow-draft suggestions inside a writing project.

Current review model:

- canonical draft: `writings/<slug>/draft.md`
- agent working copy: `writings/<slug>/draft.shadow.md`
- review surface: split-screen diff review mode inside native Obsidian editors
- archived web prototype: `archive/app/`

Main command:

- `Toggle Diff Review Mode`

Use it while `draft.md` or `draft.shadow.md` is open. The plugin will:

- split the editor into draft and suggestion views
- keep both sides editable
- highlight pending changes live
- let you step through them with `Previous` / `Next`
- apply `Approve` / `Reject` on the selected change

Project contract docs:

- `SPEC.md`
- `ARCHITECTURE.md`
- `WORKFLOW.md`
