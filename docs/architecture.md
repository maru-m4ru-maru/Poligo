# Poligo Architecture

## Services

### Web

The browser IDE owns the editor, file tree, project state, preview, terminal presentation, and client-side execution.

Project metadata and source files are stored in Turso through the Poligo API. Project access is authenticated by account ID. The browser also keeps a temporary workspace identifier in localStorage for migrating legacy projects after sign-in.

### API

The API is a lightweight gateway for project operations and execution requests.

It is the only component that talks to Turso and the external runner.

It must not execute untrusted user code.

### Runner

The runner is intentionally outside the Render deployment.

It accepts execution jobs from the API and is responsible for language-specific sandboxing. When a configured runner does not support a language, the API falls back to Judge0 instead of failing the execution request.

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

Java execution uses the Judge0 Java environment. Single-file projects without runtime options use the predefined Java compiler. Projects that require multiple Java source files, Java packages, nested project files, \`.env\` variables, or command-line arguments use Judge0's multi-file program profile with generated UTF-8 compile and run scripts.

Server-side execution exposes a bounded command-line argument list to supported runtimes. The API validates arguments before dispatching them to Judge0 or the external runner. Java \`.env\` variables are exported only inside the disposable execution environment and secret environment files are never added as project archive files.

## Planned language layers

- JavaScript and TypeScript: browser or WebContainer
- HTML and CSS: browser preview
- Python: isolated worker
- C and C++: isolated worker
- Rust: isolated worker
- Go: isolated worker
- Java and Kotlin: isolated execution backend
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

Project APIs require an authenticated account and use the account ID as the owner key. The temporary browser-generated workspace identifier is only used by the authenticated workspace-claim endpoint to migrate legacy projects. It is not accepted as an authorization credential for project access.

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

The browser sends the workspace identifier when claiming legacy projects. Normal project requests use the authenticated account ID, and the API validates ownership against that ID before reading or mutating a project.
