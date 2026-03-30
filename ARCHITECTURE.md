# Writing Copilot Architecture

## Repo Direction

This repository now targets an Obsidian plugin as the primary product. The previous web prototype has been moved to `archive/app/` so it can still be mined for diff logic, copy, and interaction references without constraining the shipping architecture.

## Phase 0 Repo Layout

```text
.
├── archive/app/           # Archived Next.js prototype
├── writings/              # Example and real writing projects
├── skills/                # Local Codex skill material
├── manifest.json          # Obsidian plugin manifest
├── versions.json          # Obsidian compatibility map
├── esbuild.config.mjs     # Plugin bundler config
├── tsconfig.json          # Plugin TypeScript config
├── SPEC.md
├── ARCHITECTURE.md
└── WORKFLOW.md
```

## Planned Runtime Architecture

The plugin runtime will be split into four layers:

1. Plugin shell
   Registers commands, view types, lifecycle hooks, and vault event listeners.
2. Project discovery
   Resolves the active note into a writing project and validates the file contract.
3. Review domain
   Parses request records, computes diff hunks, applies accept/reject decisions, and protects canonical state.
4. Review UI
   Renders the persistent `Review` pane with `Changes` and `Requests` tabs.

## Data Boundaries

- Native Obsidian editor owns direct writing in `draft.md`.
- Agent output lands in `draft.shadow.md` only.
- Request provenance lives in `writings/<slug>/requests/`.
- Review UI reads both files plus request metadata, then emits explicit decisions back through the review domain.

## Safety Constraints

- Never mutate `draft.md` implicitly from generation output.
- Never assume a complete shadow edit was accepted.
- Treat stale review state as a conflict condition once file watching is introduced.
- Preserve enough metadata to explain which request produced the current review pass.

## Reference Reuse Policy

The archived web prototype may inform implementation details in limited ways:

- diff grouping behavior
- review copy and empty-state wording
- test cases for file and diff behavior

It should not determine the main editor model, pane architecture, or shipping UI container.
