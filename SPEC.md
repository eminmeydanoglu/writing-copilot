# Writing Copilot Plugin Spec

## Product Goal

Build an Obsidian plugin for collaborative writing review where the native Obsidian editor remains the main writing surface and the plugin owns suggestion review.

## Core Invariants

- `draft.md` is canonical.
- Agents write only to `draft.shadow.md`.
- Review decisions belong to the user.
- The plugin provides a persistent `Review` pane inside Obsidian.
- Review actions are diff-based and operate on explicit hunks.
- The plugin records which request produced the current suggestion pass.

## v1 Scope

The frozen `v1` scope is:

- custom Obsidian review pane
- `Changes` tab
- `Requests` tab
- diff hunk generation for `draft.md` vs `draft.shadow.md`
- single-hunk `Accept`
- single-hunk `Reject`
- bulk `Accept all`
- bulk `Reject all`
- request metadata loading from project files
- safe synchronization after partial and complete review

## Out Of Scope For v1

The following are explicitly out of scope:

- inline suggestion widgets inside the native editor
- shipping the archived web UI as the product surface
- autonomous in-plugin orchestration of Writer/Philosopher runs
- hidden auto-accept behavior
- replacing the native Obsidian markdown editor

## Project File Contract

Each writing project must contain:

- `writings/<slug>/draft.md`
- `writings/<slug>/draft.shadow.md`
- `writings/<slug>/project.md`
- `writings/<slug>/resources/`
- `writings/<slug>/requests/`

Request records live under:

- `writings/<slug>/requests/<request-id>.json`
- `writings/<slug>/requests/<request-id>.md` optional

## Request Record Fields

The minimum request metadata model for `v1` is:

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

## Review Model

- Diffs are always computed from canonical to shadow.
- Canonical content changes only through explicit review actions.
- Rejecting a hunk preserves canonical text while updating shadow state safely.
- Completing review leaves `draft.md` and `draft.shadow.md` aligned.

## Reference Material

The previous Next.js prototype is preserved under `archive/app/` strictly as reference material. It is not the shipping architecture and should not drive product-surface decisions.
