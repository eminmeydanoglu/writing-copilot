# Prompt Assembly

Prompt quality comes from disciplined layering, not from one oversized instruction block.

## Stable vs Volatile Inputs

Keep these stable:

- platform rules
- project notes such as `project.md` when present

Keep these volatile:

- current user request
- selected resource passages
- the current excerpt from `x.md`
- review objective for this run

Do not rewrite stable inputs into ad hoc prompt prose every turn. Read them from disk and compose them deterministically.

## Assembly Order

Use this shared order:

1. platform/system rules
2. project notes when present
3. agent-specific role instructions
4. current task
5. selected resource evidence
6. local excerpt from the draft

Then specialize by agent.

### `Philosopher`

Usually do not add the default writing guide or shared style files. This agent is for concepts, distinctions, claims, and evidence unless the task is explicitly about style analysis.

### `Writer`

Add these layers after the shared order:

1. default writing guide
2. selected shared style files referenced by project notes when present
3. selected claims, notes, or other material the writer should work from when relevant

Later layers should specialize earlier ones, not silently override them.

## Selection Rules

- Include only passages relevant to the current task.
- Prefer a local excerpt from `x.md` over the whole document.
- Never load the entire `writings/styles/` folder. Load only the style files selected for the project.
- Read style choices from the `## Style Direction` section of `project.md` when that file exists.
- Under `## Style Direction`, parse only the leading bullet list as loadable style ids.
- Treat those ids as exact filenames without the `.md` suffix.
- When `project.md` describes a mixture, load only the named style files and keep the mixture instruction in the prompt as project-local guidance.
- Pass citations and source snippets to `Philosopher`.
- Pass selected claims, style rules, and local context to `Writer` when the task benefits from them.
- When evidence is weak, state that the result is inference rather than direct support.

## Agent Inputs

### `Philosopher`

Send:

- `project.md` when present
- research question
- selected resource passages
- any relevant excerpt from `x.md`

Expect:

- claims
- distinctions
- counterpoints
- source-backed notes
- explicit uncertainty

### `Writer`

Send:

- `project.md` when present
- default writing guide
- selected shared style files referenced by `project.md` when present
- selected claims, notes, or other working material when relevant
- target section or excerpt from `x.md`
- the requested operation: draft, rewrite, compress, extend, reframe

Expect:

- prose suggestions
- alternative phrasings
- structure-preserving rewrites
- minimal-delta edits when revising
