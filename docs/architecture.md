# Poligo Architecture

## Services

### Web

The browser IDE owns the editor, file tree, local project state, preview, terminal presentation, and client-side execution.

### API

The API owns projects, authentication boundaries, execution job creation, sharing, and service orchestration.

### Runner

The runner is isolated from the public internet. It accepts execution jobs from the API and is the future home for language-specific sandboxes.

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
Runner
  |
  +--> language sandbox
```

The API never exposes the runner directly to the browser.

## Planned language layers

- JavaScript and TypeScript: browser or WebContainer
- HTML and CSS: browser preview
- Python: isolated worker
- C and C++: isolated worker
- Rust: isolated worker
- Go: isolated worker
- Java and Kotlin: isolated worker
- Additional languages through runner profiles

## Data

The first milestone keeps project state client-side.

A persistent database will be introduced after the editor and execution contract stabilize.

## Security

Untrusted user code must never execute inside the API process.

The runner will be private, resource-limited, network-isolated, and disposable at the sandbox level.

## Deployment

Render hosts the web application as a static site, the API as a public web service, and the runner as a private service.
