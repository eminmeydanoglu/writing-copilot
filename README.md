# writing-copilot

## Installation

Run it once with `npx`:

```bash
npx writing-copilot
```

Install it globally:

```bash
npm install -g writing-copilot
writing-copilot
```

Install it locally in a project:

```bash
npm install writing-copilot
npx writing-copilot
```

## Usage

Start the app:

```bash
writing-copilot
```

If it is installed locally instead of globally:

```bash
npx writing-copilot
```

Relevant environment variables:

```bash
WRITING_COPILOT_WORKSPACE_DIR=/path/to/workspace
WRITING_COPILOT_HOST=127.0.0.1
WRITING_COPILOT_PORT=3000
WRITING_COPILOT_NO_OPEN=1
```

`WRITING_COPILOT_NO_OPEN=1` disables automatic browser launch.

## Workspace Data

Workspace data is stored in `./data/workspace` by default, relative to the directory where you run the command.

Set `WRITING_COPILOT_WORKSPACE_DIR` if you want to keep the workspace somewhere else.

## Development

From a repository checkout:

```bash
npm install
npm run app
```

Useful scripts:

```bash
npm run dev
npm test
npm run typecheck
```
