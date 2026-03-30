# Obsidian Writing Copilot Implementation Plan

## Goal

Build an Obsidian plugin for a collaborative writing copilot with these core invariants:

- `draft.md` is canonical.
- Agents write only to `draft.shadow.md`.
- Review decisions belong to the user.
- The plugin provides a persistent `Review` pane in Obsidian.
- The plugin provides diff-based `Accept` / `Reject` review actions.
- The plugin provides a `Requests` view showing which request produced which changes.

## Product Direction

- The main writing surface stays the native Obsidian markdown editor.
- The review experience lives in a custom Obsidian view.
- Inline editor suggestion widgets are out of scope for `v1`.
- The existing web app is reference material, not the shipping architecture.
- `obsidian-file-diff` may be used as a reference for diff views and contiguous hunk grouping, but not as the product model.

## Working Rules For The Executor Agent

- Implement phase by phase.
- After each phase, stop and report:
  1. what changed/ what was the goal
  2. Let an subagent review w.r.t specs
  3. exact commands or steps to test
  4. known risks or limitations
- At the end of each phase, ask the user exactly this:


- Do not continue to the next phase until the user confirms.
- Prefer small, reviewable patches.
- Protect against data loss.
- Write tests for non-UI core logic before relying on UI behavior.
- Keep the native Obsidian editor as the main writing experience.

## Project Contract

Each writing project should follow this structure:

- `writings/<slug>/draft.md`
- `writings/<slug>/draft.shadow.md`
- `writings/<slug>/project.md`
- `writings/<slug>/resources/`
- `writings/<slug>/requests/`

Request records should live under:

- `writings/<slug>/requests/<request-id>.json`
- `writings/<slug>/requests/<request-id>.md` optional

Suggested JSON fields:

- `id`
- `agent`
- `title`
- `task`
- `createdAt`
- `status`
- `shadowRevision`
- `notesPath` optional
- `resultPath` optional
- `acceptedCount` optional
- `rejectedCount` optional

## Target User Workflow

1. The user writes normally in `draft.md` inside Obsidian.
2. A Writer or Philosopher run produces suggestions in `draft.shadow.md`.
3. The plugin records that run as a request entry.
4. The user opens the persistent `Review` pane.
5. The `Changes` tab shows diff hunks between `draft.md` and `draft.shadow.md`.
6. The user accepts or rejects changes hunk by hunk, or uses bulk actions.
7. The `Requests` tab shows what request created the current suggestion pass.
8. When review completes, `draft.shadow.md` is synchronized safely back to the canonical state.

## Phase 0: Scope Freeze And Repo Setup

### Deliverables

- Plugin repo scaffold.
- `SPEC.md`
- `ARCHITECTURE.md`
- `WORKFLOW.md`
- Frozen `v1` scope:
  - custom review pane
  - diff hunks
  - accept/reject
  - requests pane
  - no inline editor widgets
  - no autonomous in-plugin pipeline yet
- Project folder contract documented.

### Acceptance Criteria

- Scope is explicit.
- File contract is explicit.
- Out-of-scope items are explicit.

### Manual Test For User

- Read the docs.
- Confirm the product contract matches the intended workflow.
- Confirm the `v1` scope is right.

### Agent Must Ask

`Phase 0 is ready for manual testing. Please review SPEC.md, ARCHITECTURE.md, and WORKFLOW.md, then tell me whether the product contract and v1 scope are correct, or what to change before I proceed.`

## Phase 1: Plugin Skeleton

### Deliverables

- Obsidian plugin scaffold.
- `src/main.ts`
- custom view registration with `registerView`
- `Open Review Pane` command
- minimal pane shell
- React root or plain custom view shell

### Acceptance Criteria

- Plugin installs in Obsidian.
- `Open Review Pane` opens a custom view.
- Plugin restart does not crash the vault.

### Manual Test For User

- Install plugin in a test vault.
- Enable it.
- Run `Open Review Pane`.
- Confirm pane opens reliably.
- Restart Obsidian once and verify the plugin still behaves correctly.

### Agent Must Ask

`Phase 1 is ready for manual testing. Please install the plugin in a test vault, open the Review pane, restart Obsidian once, and tell me whether it behaves correctly or what broke.`

## Phase 2: Project Discovery

### Deliverables

- `src/lib/project.ts`
- active note to project-root resolution
- validation for required files
- clear empty and error states when not inside a valid project

### Acceptance Criteria

- The pane recognizes a valid writing project from the active file.
- The pane reports understandable errors for invalid contexts.

### Manual Test For User

- Open a valid `draft.md` and confirm the pane recognizes the project.
- Open an unrelated markdown file and confirm the plugin shows a clear error or empty state.
- Rename or move a required file and confirm the message remains understandable.

### Agent Must Ask

`Phase 2 is ready for manual testing. Please test project detection with a valid writing project and with an unrelated note, then tell me whether the discovery behavior and error states are acceptable.`

## Phase 3: Data Model And Request Schema

### Deliverables

- TS types for:
  - workspace project
  - request record
  - request status
  - diff hunk
  - diff segment
  - review decision
- request parsing and indexing
- unit tests for schema and parsing

### Acceptance Criteria

- Request records load cleanly.
- The schema captures the context needed in the Requests view.

### Manual Test For User

- Inspect a sample request record.
- Confirm the fields are sufficient:
  - agent
  - task
  - createdAt
  - status
  - prompt/notes/result references if needed

### Agent Must Ask

`Phase 3 is ready for manual testing. Please inspect the request schema and sample metadata, and tell me whether the model captures the information you want to see in the Requests view.`

## Phase 4: Diff Engine

### Deliverables

- `src/lib/diff.ts`
- diff generation for `draft.md` vs `draft.shadow.md`
- contiguous hunk splitting
- support for add/remove/modify
- unit tests for edge cases

### Acceptance Criteria

- Hunk grouping is stable and predictable.
- Multi-hunk documents are handled correctly.

### Manual Test For User

- Create differences between `draft.md` and `draft.shadow.md`.
- Confirm the plugin reports the correct hunk count.
- Check whether hunk grouping matches your intuition.

### Agent Must Ask

`Phase 4 is ready for manual testing. Please create a few shadow edits, compare the reported hunks with your expectations, and tell me whether the grouping feels correct or needs adjustment.`

## Phase 5: Review Decision Engine

### Deliverables

- `src/lib/review.ts`
- single-hunk accept
- single-hunk reject
- accept all
- reject all
- safe synchronization logic
- unit tests for partial and complete reviews

### Acceptance Criteria

- Canonical text changes only by explicit review decision.
- Partial review preserves remaining hunks correctly.
- Review completion leaves canonical and shadow aligned.

### Manual Test For User

- Accept one hunk and verify `draft.md` updates correctly.
- Reject one hunk and verify `draft.md` remains canonical while `draft.shadow.md` updates correctly.
- Test partial review.
- Test full review completion.

### Agent Must Ask

`Phase 5 is ready for manual testing. Please test single-hunk accept, single-hunk reject, partial review, and full review completion, then tell me whether file behavior is correct or whether you found any unsafe cases.`

## Phase 6: Review Pane v1

### Deliverables

- `Changes` tab UI
- pending count
- hunk list
- selected hunk summary
- diff rendering
- `Accept`
- `Reject`
- `Accept all`
- `Reject all`
- empty and complete states

### Acceptance Criteria

- The user can review a complete suggestion pass in the pane.
- The interaction model is understandable without extra explanation.

### Manual Test For User

- Open the pane on a project with pending changes.
- Navigate between hunks.
- Use all four review actions.
- Judge whether the pane is understandable and lightweight.

### Agent Must Ask

`Phase 6 is ready for manual testing. Please use the Review pane end to end on a project with pending changes and tell me whether the interaction model is clear, or where it feels confusing or heavy.`

## Phase 7: Requests Pane

### Deliverables

- `Requests` tab in the review view
- request list
- filtering
- selected request detail panel
- mapping between request metadata and current review state where possible

### Acceptance Criteria

- The user can tell which request produced which change pass.
- Request detail gives enough context for trust and recall.

### Manual Test For User

- Open the `Requests` tab.
- Confirm you can see which request created which suggestion pass.
- Confirm the detail level feels sufficient.

### Agent Must Ask

`Phase 7 is ready for manual testing. Please review the Requests tab and tell me whether it gives enough context about who asked for what, when, and what changes resulted.`

## Phase 8: External Agent Integration Adapter

### Deliverables

- `src/lib/agents.ts`
- adapter for external generation flow
- support for writing outputs to `draft.shadow.md`
- automatic request record creation for runs

### Acceptance Criteria

- Running generation updates `draft.shadow.md`, not `draft.md`.
- A request record is created for each run.

### Manual Test For User

- Trigger an available Writer-style run.
- Trigger an available Philosopher-style run if implemented.
- Confirm a request record appears.
- Confirm output lands in `draft.shadow.md`.

### Agent Must Ask

`Phase 8 is ready for manual testing. Please run the available generation flow, confirm that outputs land in draft.shadow.md and requests are recorded correctly, then tell me whether the integration behaves as expected.`

## Phase 9: Live Refresh And File Watching

### Deliverables

- refresh behavior on:
  - `draft.md` changes
  - `draft.shadow.md` changes
  - request file changes
- stale UI prevention
- non-destructive refresh behavior

### Acceptance Criteria

- The pane updates without manual reload.
- External edits do not silently clobber state.

### Manual Test For User

- Edit `draft.md` manually and confirm refresh.
- Edit `draft.shadow.md` manually and confirm refresh.
- Add or edit a request file and confirm refresh.

### Agent Must Ask

`Phase 9 is ready for manual testing. Please modify draft.md, draft.shadow.md, and a request file while the pane is open, then tell me whether live refresh feels reliable or where it desynchronizes.`

## Phase 10: Safety And Recovery

### Deliverables

- stale review or conflict warning banner
- snapshot or lightweight backup before destructive actions
- restore-last-review-state if feasible
- hardened edge-case handling

### Acceptance Criteria

- Conflicting edits during review do not silently corrupt data.
- Recovery path exists for risky review actions.

### Manual Test For User

- Start review, then externally edit files before clicking accept or reject.
- Confirm the plugin warns instead of silently corrupting content.
- Test recovery flow if one is provided.

### Agent Must Ask

`Phase 10 is ready for manual testing. Please simulate conflicting edits during review and tell me whether the plugin protects your data well enough, or where recovery and warnings still feel weak.`

## Phase 11: UX Polish

### Deliverables

- improved copy
- spacing and hierarchy polish
- keyboard navigation
- simpler empty, loading, and success states
- reduced visual noise

### Acceptance Criteria

- The plugin feels fast and understandable in a real writing session.
- Common review actions are easy to discover.

### Manual Test For User

- Use the plugin in one realistic writing and review session.
- Judge clarity, speed, and friction.
- Note anything still awkward or visually heavy.

### Agent Must Ask

`Phase 11 is ready for manual testing. Please use the plugin in a realistic short writing session and tell me what still feels awkward, slow, or visually noisy before I prepare release-quality docs.`

## Phase 12: Packaging And Release Docs

### Deliverables

- final `README.md`
- installation instructions
- sample project
- screenshots or GIFs
- migration note from web prototype to plugin workflow

### Acceptance Criteria

- A new user can install the plugin in a clean vault and understand the workflow.

### Manual Test For User

- Follow the README from scratch in a clean vault.
- Confirm setup is understandable.
- Confirm the sample project demonstrates the workflow clearly.

### Agent Must Ask

`Phase 12 is ready for manual testing. Please follow the README in a clean vault and tell me whether the setup and onboarding are clear enough for a first-time user.`

## Definition Of Done

- The user writes normally in `draft.md`.
- Generation writes only to `draft.shadow.md`.
- Obsidian shows a persistent review pane.
- The user can review changes hunk by hunk with `Accept` and `Reject`.
- The user can inspect request provenance in `Requests`.
- The plugin avoids silent data loss.

## Recommended Milestone Boundary

Treat `Phase 6` as the first real product milestone. At that point the core review workflow is already validated:

- project discovery
- diff engine
- review decision engine
- review pane

## Execution Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9
11. Phase 10
12. Phase 11
13. Phase 12

## Reference Links

- Obsidian custom views: https://docs.obsidian.md/plugins/Plugins/User+interface/Views
- Obsidian React in plugin: https://docs.obsidian.md/plugins/Plugins/Getting+started/Use+React+in+your+plugin
- Obsidian editor access: https://docs.obsidian.md/plugins/Plugins/Editor/Editor
- Obsidian vault operations: https://docs.obsidian.md/plugins/Plugins/Vault
- Obsidian File Diff reference: https://github.com/friebetill/obsidian-file-diff
