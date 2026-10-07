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
          +--> Turso
          |
          +--> External Runner
```

## Project storage

Poligo stores projects in Turso through the API.

Each project has a project ID, anonymous workspace owner ID, name, timestamps, and a separate set of source files. The editor automatically saves changes to the cloud and restores the selected project after reload.

The browser does not connect directly to Turso.

Projects are owned by the authenticated account ID. A temporary browser workspace ID is used only during sign-in migration so legacy projects can be claimed by the account.

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
- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN
- POLIGO_ENCRYPTION_KEY
- BETTER_AUTH_URL
- BETTER_AUTH_SECRET
- RUNNER_URL
- RUNNER_TOKEN
- OPENROUTER_API_KEY

The runner can be hosted independently and replaced without changing the IDE frontend. If the configured runner does not support a language, the API falls back to Judge0.

Java execution supports single-file programs as well as multi-file projects and package declarations. Java multi-file execution uses Judge0's multi-file program profile with generated UTF-8 compile and run scripts.
