# Project Files

Use this contract for writing-copilot projects:

```text
writings/
  styles/
    lyrical-analytic.md
    austere-essay.md
  <folder>/
    essay.md
    essay.shadow
    project.md          # optional
    resources/          # optional
```

## Required Pair

### `x.md`

The canonical draft. User edits and accepted agent changes land here.

### `x.shadow`

The agent working copy in the same folder. Let agents edit this file with normal tools. Never treat it as the source of truth after review; the platform will diff it against `x.md`, handle review, and later resync from the final `x.md`.

## Review Contract

Agent edits are proposals, not final writes.

The platform may let the user:

- accept or reject some part of the suggestions
- write their own words

The agent does not create this review request explicitly. It only edits `x.shadow`; the interface and backend infer the diff and expose the review flow.

After review, use the resulting `x.md` as the only source of truth. To understand what the user kept, compare the later `x.md` against the earlier suggestion instead of assuming that the whole shadow edit landed.

### `project.md`

Optional.

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

Optional.

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

Use matching sibling names. If the canonical file is `essay.md`, the shadow file must be `essay.shadow`.
