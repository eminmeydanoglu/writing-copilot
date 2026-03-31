---
name: writing-copilot-projects
description: Use when structuring or running a collaborative writing-copilot workspace for essays, articles, or long-form drafts that live in project folders with shared style files, source materials, and reviewable agent suggestions.
---

# Writing Copilot Projects

## Overview

Run writing work as files on disk, not as a disposable chat. Keep `x.md` canonical, edit only the sibling `x.shadow`, and let the platform handle diff review. Treat style as a shared library under `writings/styles/`, and keep extra project notes in separate files only when they help.

Start the plugin inside Obsidian after installing the repository build output into your vault plugin folder.

## Collaboration Model

This is a collaborative system, not an autonomous pipeline. `Philosopher` and `Writer` are different thinking contexts, not rigid stages that must always run in sequence. The main agent decides when to use one, both, or neither based on the state of the draft, the user's intent, and the kind of help needed in the current turn.

Keep only a few hard invariants:

- `x.md` is canonical
- agents edit only the sibling `x.shadow`
- review decisions stay with the user and main agent
- direct support should stay distinct from inference
- prompts should include only the context needed for the current run

## Typical Flow

1. Install and enable the plugin in Obsidian.
2. Create or open `x.md`.
3. Keep stable project intent in files on disk, not in ephemeral chat turns.
4. Compile agent prompts from fixed layers instead of improvising a giant prompt each time.
5. Use `Philosopher` when the task needs research, claim extraction, distinctions, or source-backed conceptual material.
6. Use `Writer` when the task needs prose options, rewrites, or style-conforming draft suggestions.
7. Let agents work in the sibling `x.shadow`, then let the platform diff against `x.md` and present review controls.
8. Let the user accept all, reject all, or accept only selected parts.
9. After review, treat the current `x.md` as ground truth and infer what was accepted or rejected by rereading it rather than assuming the whole shadow edit landed.

## Project Contract

Required pair:

- `x.md`: canonical draft
- `x.shadow`: agent working copy in the same folder

Optional supporting files:

- `project.md`: topic, project description, style direction, scope, open questions
- `resources/`: PDFs, sample texts, notes, and other source material

Keep shared styles in `writings/styles/`. In `project.md`, use a dedicated `## Style Direction` section with this contract:

- leading bullet items are exact style ids
- each style id maps to `writings/styles/<style-id>.md`
- prose under the list may describe mixtures, weights, and local adjustments

Read [references/project-files.md](references/project-files.md) when creating or repairing a project structure.

## Prompt Assembly

Do not dump the whole project into the prompt. Assemble only the layers needed for the current run.

Shared order:

1. Platform rules
2. project notes such as `project.md` when present
3. Agent-specific role instructions
4. Current task
5. Relevant resource passages or notes
6. Relevant excerpt from `x.md`

Writer-only additions:

7. Default writing guide
8. Selected shared style files referenced by project notes when present

Read [references/prompt-assembly.md](references/prompt-assembly.md) before building agent context.
Read [references/style-library.md](references/style-library.md) when creating, naming, or selecting shared styles.

## Agent Split

Keep roles narrow:

- `Philosopher`: find passages, extract claims, separate direct support from inference, return research material rather than polished prose
- `Writer`: turn selected claims and local draft context into prose suggestions that fit the project voice
- main agent: orchestrate, choose what to send to whom, keep user-facing synthesis and review decisions centralized

These are soft role boundaries for context separation. They guide what kind of help each agent is best at, but they are not a rigid workflow or a complete behavioral spec.

## Editing Boundary

Agents edit only `x.shadow`. They do not apply diffs or decide review outcomes. When they need to understand what survived review, they should inspect the later state of `x.md`.

## Default Style Baseline

Use the baseline in [references/default-writing-guide.md](references/default-writing-guide.md) unless the project explicitly overrides it. Shared style files usually refine this baseline rather than replacing it wholesale.

## Common Mistakes

- Loading the whole `writings/styles/` library into the prompt instead of selecting only the active style files
- Letting agents edit `x.md` directly
- Assuming a full shadow edit was accepted without checking the reviewed result in `x.md`
- Feeding whole PDFs or whole drafts into prompts instead of selecting relevant passages
- Asking `Philosopher` to draft finished prose when the task is really evidence gathering
- Letting shared styles drift into topic notes instead of keeping them as reusable voice patterns
- Reintroducing a project-local `style.md` or `project.json` when `project.md` already captures the project intent cleanly
