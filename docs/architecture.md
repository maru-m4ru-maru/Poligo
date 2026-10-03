# Poligo Architecture

## Services

### Web

The browser IDE owns the editor, file tree, local project state, preview, terminal presentation, and client-side execution.

### API

The API is a lightweight gateway for project operations and execution requests.

It must not execute untrusted user code.

### Runner

The runner is intentionally outside the Render deployment.

It accepts execution jobs from the API and is responsible for language-specific sandboxing.

## Execution model

Browser-native workloads run in the browser whenever possible.

Server-side workloads use this flow:

```text
Web
  |
  v
API
  |
  v
External Runner
  |
  +--> language sandbox
```

The browser never talks directly to the runner.

## Planned language layers

- JavaScript and TypeScript: browser or WebContainer
- HTML and CSS: browser preview
- Python: isolated worker
- C and C++: isolated worker
- Rust: isolated worker
- Go: isolated worker
- Java and Kotlin: isolated worker
- Additional languages through runner profiles

## Security

Untrusted user code must never execute inside the API process.

The runner must provide:

- process isolation
- CPU limits
- memory limits
- execution timeouts
- filesystem isolation
- restricted network access
- disposable workspaces

## Render role

Render hosts the static IDE and lightweight API.

Render is not used as the primary code-execution infrastructure.
