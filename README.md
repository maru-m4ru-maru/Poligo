# Poligo

Poligo is a self-hosted browser IDE designed around a modular execution architecture.

## Repository layout

- apps/web: browser IDE
- services/api: public API and project gateway
- services/runner: private code execution service
- packages/protocol: shared API contracts
- docs: architecture and development notes

## Core principles

- Browser-first development
- Local execution for browser-native workloads
- Private execution workers for server-side languages
- Service boundaries that can scale independently
- No dependency on a hosted IDE vendor for the core product

## Development

```text
pnpm install
pnpm dev:web
pnpm dev:api
pnpm dev:runner
```

## Deployment

Render configuration is provided in `render.yaml`.

The runner is configured as a private service. The API reaches it over Render's private network.
