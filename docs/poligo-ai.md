# Poligo AI provider setup

Poligo exposes one assistant in the IDE: **Poligo AI**. Provider and model selection are handled by the API and are not displayed to users.

## Cloudflare Workers AI

Set the following environment variables on the Poligo API service in Render:

- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN`: a secret API token with Workers AI permissions. Keep this value in Render's secret environment settings; do not commit it.
- `CLOUDFLARE_AI_MODEL` (optional): a Workers AI model ID. The default is `@cf/qwen/qwen2.5-coder-32b-instruct`.

The API tries Cloudflare Workers AI first when both required Cloudflare values are configured. If that provider is not configured or a request fails, Poligo AI falls back to OpenRouter when `OPENROUTER_API_KEY` is available. Provider and model identifiers are never returned to the browser.

Cloudflare's REST API setup and token permissions are documented at [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/). The default coding model is listed in the [Cloudflare Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/).

## OpenRouter fallback

Keep `OPENROUTER_API_KEY` configured if Poligo should automatically fall back when Workers AI is unavailable. Existing `OPENROUTER_MODEL_FAST`, `OPENROUTER_MODEL_CODE`, and `OPENROUTER_MODEL_REASONING` settings remain server-side implementation details and are not shown in the interface.

If neither provider has valid configuration, Poligo AI returns a generic temporary-unavailable message rather than exposing server configuration details.
