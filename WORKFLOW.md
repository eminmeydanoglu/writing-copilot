# Writing Copilot Workflow

## User Workflow

1. The user writes in `draft.md` with the native Obsidian markdown editor.
2. A Writer or Philosopher run updates `draft.shadow.md`.
3. The system records that run under `writings/<slug>/requests/`.
4. The user opens the persistent `Review` pane.
5. The `Changes` tab shows diff hunks between `draft.md` and `draft.shadow.md`.
6. The user accepts or rejects changes hunk by hunk, or uses bulk actions.
7. The `Requests` tab shows which request created the current suggestion pass.
8. After review, `draft.shadow.md` is synchronized safely with the accepted canonical result.

## Project Contract

Each project should follow this structure:

```text
writings/<slug>/
├── draft.md
├── draft.shadow.md
├── project.md
├── resources/
└── requests/
```

## Development Workflow

Execution will follow `IMPLEMENTATION_PLAN.md` phase by phase:

1. freeze scope and repo direction
2. build the plugin skeleton
3. add project discovery
4. define data and request models
5. implement diff generation
6. implement review decisions
7. build the Review pane
8. add Requests provenance
9. integrate external generation adapters
10. harden refresh and safety behavior
11. polish UX
12. package and document release flow

## Phase Boundary Rule

After each phase:

1. summarize what changed and what the phase goal was
2. request a subagent review against the spec
3. provide exact test commands or manual test steps
4. report known risks or limitations
5. stop for user confirmation before continuing

## Current Status

Phase 0 establishes the contract, architecture, and repo scaffold only. The plugin entrypoint and Review pane implementation begin in Phase 1.
