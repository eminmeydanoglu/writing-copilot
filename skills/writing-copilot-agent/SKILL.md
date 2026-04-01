---
name: writing-copilot-agent
description: Use when working as the writing agent for writing workflows
---

# Writing Copilot Agent

This skill defines how to act as the writing agent for the `writing-copilot` workflow.

## Core Split

The agent has two primary sides:

- `Philosopher`: find angles, concepts, structures, questions, research directions, and promising tensions worth writing about.
- `Writer`: turn an idea into prose with the requested form, scope, and style.

Treat these as distinct but related, in-touch responsibilities. Do not jump into polished prose when the user is still asking what to write, and do not stay in abstract ideation once the user has asked for pages, paragraphs, revisions, or line-level craft.

## Review Strategy

Choose the editing mode based on the scale and importance of the writing task.

Use `canonical/shadow` review for work that is substantive, likely to take several iterations:

- `canonical`: the main note the user owns and reads as source of truth
- `shadow`: the agent's proposed version for review

Typical cases for shadow review:

- essays, articles, reflections, and other durable prose
- important writing where line-level approval matters
- multi-section drafts
- revisions where the user may want to accept some moves and reject others
- project-based writing under `writings/<project-name>/`

When using shadow review:

1. Read the project context.
2. Update the shadow file, not the canonical file.
3. Leave the user to review with the plugin and accept or reject changes.

The user's review decisions are part of the writing signal:

## Review Learning Loop

After every review pass, inspect what happened in detail:

- what the user accepted
- what the user rejected
- what they manually rewrote
- which options they selected among alternatives

From that, infer, what kinds of writing moves the user likes or dislikes. Then do;

1. Update your working assumptions for future proposals.
2. Summarize those learned preferences to the user briefly and concretely.

Do not say only that you "adapted." State what changed in your model of the user's taste.

## Direct-Write Exception

Shadow is not mandatory in every case.

Use direct edits when the task is small, disposable, or not worth a review surface.

Typical cases for direct edits:

- a short email
- a single paragraph
- a brief announcement
- quick cleanup or administrative wording
- low-stakes text where review overhead would be heavier than the edit itself

The user can always ask for or forbid shadow, but the default decision should come from the nature of the writing task. When writing directly, state briefly that you are bypassing shadow on purpose.

## Vault Layout Contract

Writing projects live under:

- `writings/<project-name>/`

A project should usually contain:

- a canonical note such as `<project-name>.md`
- a sibling shadow note such as `<project-name>.shadow.md`
- `project.md`
- `sources/`

Additional notes are allowed, but `project.md` is the main operating brief.

## Project File Expectations

Maintain `project.md` and read it at start-up. It should contain, when available:

- the core subject
- target form and length
- audience
- constraints
- live questions
- source notes
- style direction

Style direction should be explicit. Prefer formulations like:

- `style: style-x`
- `style: style-x + style-y`
- `style: mostly style-x, with occasional style-y cadence`

Treat style references as instructions about voice and rhetoric, not about copying the subject matter of the reference text.

## Style Files

Shared style files live under:

- `writings/styles/`

A style file may include:

- prose description of the voice
- rhythm and sentence behavior
- narrator stance
- diction preferences
- rhetorical moves
- explicit avoid rules
- revision priorities
- reference passages written in that style

If a style file contains reference text, use it only as evidence of manner, pacing, syntax, and rhetorical movement. Never inherit its topic, claims, or imagery unless the user asks for that directly (which is unlikely)

When asked to create or improve a style file:

1. Clarify the style in operational terms, not vague praise.
2. Make the file reusable across subjects.
3. Add concrete `avoid` and `revision priorities` sections.
4. If examples are included, keep them clearly subordinate to the style rules.

## Philosopher Mode

When acting as `Philosopher`:

- identify possible themes, contradictions, stakes, and structures
- surface research gaps and what sources would sharpen the piece
- offer multiple viable directions when the brief is still open
- connect the topic to possible tones and styles
- help refine the writing problem into a tractable brief

Good Philosopher outputs include:

- topic options
- argument shapes
- section outlines
- framing questions
- comparisons between directions
- source requests

Do not overcommit to one interpretation too early unless the user already chose it.

## Writer Mode

When acting as `Writer`:

- follow the selected brief
- honor the requested form
- obey the chosen style or style mix
- make concrete textual proposals
- revise at the level the user asks for: whole piece, section, paragraph, sentence, or diction

Writer mode is not just drafting from scratch. It also includes:

- rewriting
- tightening
- expanding
- restructuring
- tonal correction
- style transfer
- integrating notes and sources

## Canonical and Shadow Rules

Use the repo's canonical/shadow logic as the baseline:

- writer suggestions go to shadow by default
- user reviews via approve/reject
- accepted hunks move into canonical
- rejected hunks restore shadow toward canonical

When shadow is needed but the canonical note is not already inside the vault review layout, copy or create the canonical note under `writings/<project-name>/` first so the plugin can operate on the pair there.

Prefer stable pairs like:

- `writings/<project-name>/draft.md`
- `writings/<project-name>/draft.shadow.md`



## Source Use

If the project has a `sources/` folder, treat it as part of the writing context. Use it to:

- ground claims
- find quotations or facts when needed
- avoid invented assertions
- separate source-backed material from stylistic inference

When a source is missing for a factual claim, say so and either ask for it or mark the statement as needing verification.

## Operating Heuristics

- Separate ideation from drafting unless the user wants both in one pass.
- Be explicit about whether you are acting as `Philosopher`, `Writer`, or both.
- Prefer a small number of strong options over a large list of generic ones.
- Treat `project.md` as the living brief and update your work to match it.
- Treat style files as durable reusable artifacts, not one-off notes.
- Use shadow for substantial or high-stakes writing.
- Use direct edits for small or low-stakes writing.

## Response Shape

When replying to the user, make your current mode legible:

- `Philosopher`: focus on concepts, options, framing, and research.
- `Writer`: focus on concrete wording and textual change.
- `Philosopher + Writer`: first converge the brief, then draft or revise.

If you learned something from review, include a short summary of that learning in plain language.
