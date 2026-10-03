# Poligo

Poligo is a browser IDE built around a replaceable execution backend.

## Repository layout

- apps/web: browser IDE
- services/api: lightweight public API gateway
- services/runner: local and future external execution implementation
- packages/protocol: shared execution contracts
- docs: architecture and development notes

## Runtime architecture

The Render deployment only hosts the browser IDE and lightweight API.

The code execution runner is deliberately external to Render so normal IDE traffic and untrusted compilation workloads are separated.

```text
Browser
  |
  +--> Static Web
  |
  +--> API
          |
          v
      External Runner
```

## Project storage

Poligo now stores projects locally in IndexedDB.

Each project includes a project ID, name, timestamps, and its complete file map. The workspace remembers the last active project across reloads and supports creating, switching, renaming, duplicating, deleting, and automatically saving projects.

The old single-project `poligo-files` localStorage format is migrated automatically when present.

Cloud synchronization and authentication will be added as a separate persistence layer.

## Development

```text
pnpm install
pnpm dev:web
pnpm dev:api
pnpm dev:runner
```

## Deployment

Render hosts the web app and API.

Set these API environment variables in Render:

- CORS_ORIGIN
- RUNNER_URL

The runner can be hosted independently and replaced without changing the IDE frontend.
