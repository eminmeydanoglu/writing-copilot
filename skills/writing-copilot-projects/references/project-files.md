# Project Files

Use this contract for writing-copilot projects:

```text
writings/
  styles/
    lyrical-analytic.md
    austere-essay.md
  <slug>/
    draft.md
    draft.shadow.md
    project.md
    resources/
```

## Required Files

### `draft.md`

The canonical draft. User edits and accepted agent changes land here.

### `draft.shadow.md`

The agent working copy. Let agents edit this file with normal tools. Never treat it as the source of truth after review; the platform will diff it against `draft.md`, handle review, and later resync from the final `draft.md`.

## Review Contract

Agent edits are proposals, not final writes.

The platform may let the user:

- accept or reject some part of the suggestions
- write their own words

The agent does not create this review request explicitly. It only edits `draft.shadow.md`; the interface and backend infer the diff and expose the review flow.

After review, use the resulting `draft.md` as the only source of truth. To understand what the user kept, compare the later `draft.md` against the earlier suggestion instead of assuming that the whole shadow edit landed.

### `project.md`

Keep the intellectual center of the project here:

- working title or topic
- a short project description
- thesis or central question
- scope boundaries
- intended mode: essay, reflection, review, memo, thread, and so on
- open questions
- recurring motifs or conceptual anchors
- a dedicated `## Style Direction` section whose leading bullet list names exact shared style ids, with mixtures explained in prose underneath

Example:

```md
## Project

An essay on emotional numbing as a loss of world rather than a mere loss of feeling.

## Style Direction

- lyrical-analytic
- austere-essay

Mostly lyrical-analytic, but borrow the restraint of austere-essay in the argumentative sections. Keep the opening more atmospheric than the conclusion.
```

### `resources/`

Store project material here:

- PDFs
- notes
- example texts
- quotations
- source excerpts

## Shared Styles

### `writings/styles/`

Store reusable style files here. Each file should describe a stable writing voice or revision posture, not a project topic.

Good style files contain:

- sentence rhythm
- narrator stance
- diction preferences
- forbidden habits
- revision preferences
- model texts or anti-models

Do not put project thesis, source notes, or one-off topic constraints in shared styles.

Read [style-library.md](style-library.md) when creating or curating this folder.

## Naming

Do not name the draft file after the mutable project title. Titles change.

Use fixed names: `draft.md` and `draft.shadow.md`. Do not switch between filename schemes per project.
