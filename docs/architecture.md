# Poligo Architecture

## Services

### Web

The browser IDE owns the editor, file tree, project state, preview, terminal presentation, and client-side execution.

Project metadata and source files are stored in Turso through the Poligo API. The browser keeps only a small anonymous workspace identifier and the active project identifier in localStorage.

### API

The API is a lightweight gateway for project operations and execution requests.

It is the only component that talks to Turso and the external runner.

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
  +--> API --> Turso
  |
  +--> API --> External Runner
```

The browser never talks directly to Turso or the runner.

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

Project APIs currently use an anonymous browser-generated workspace identifier as the owner key. This is a persistence boundary, not an authentication boundary. Account authentication will replace the anonymous identifier before Poligo exposes private cloud projects to multiple users.

## Render role

Render hosts the static IDE and lightweight API.

Render is not used as the primary code-execution infrastructure.

## Project persistence

Turso stores project metadata separately from source files:

```text
Turso
 |
 +--> projects
 |     +--> id
 |     +--> owner_id
 |     +--> name
 |     +--> created_at
 |     +--> updated_at
 |
 +--> project_files
       +--> project_id
       +--> path
       +--> content
```

Project create and update operations write metadata and all files atomically.

The browser sends the workspace identifier in the API request. The API validates project ownership against that identifier before reading or mutating a project.

Authentication can later replace this anonymous owner key with a verified account identifier without changing the project schema.
