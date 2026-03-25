# Style Library

Use `writings/styles/` as a shared pool of reusable voices and revision modes.

## Purpose

A style file should capture a reusable way of writing, not the substance of a single project.

Good examples:

- `lyrical-analytic.md`
- `austere-essay.md`
- `compressed-argument.md`
- `meditative-first-person.md`

Bad examples:

- `duygusuzlasma-style.md`
- `solomon-notes.md`
- `cmbyn-thoughts.md`

Those belong in project notes or resources, not in the shared style library.

## What a Style File Should Contain

- sentence length and rhythm
- narrator position
- diction preferences
- image density
- acceptable rhetorical moves
- forbidden habits
- revision priorities
- model texts or anti-models

## Selection

Prefer selecting one to three style files for a project.

Too many active styles will blur the signal and make the prompt contradictory.

The project should declare style direction in a dedicated `## Style Direction` section of `project.md`, using a leading bullet list for exact style ids, for example:

```md
## Style Direction

- lyrical-analytic
- compressed-argument

Mostly lyrical-analytic, but pull some compression from compressed-argument once the piece starts making claims.
```

Map each listed style id to a file in `writings/styles/`, such as:

- `writings/styles/lyrical-analytic.md`
- `writings/styles/compressed-argument.md`

## Authoring Rules

- Name styles by reusable voice or method, not by project title.
- Keep them broad enough to reuse, but concrete enough to change prose.
- Prefer additive guidance over vague taste words.
- When two style files conflict, the project should narrow the set instead of loading both and hoping the model resolves it.
