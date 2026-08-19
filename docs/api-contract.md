# Public API Contract

The CLI depends only on documented, versioned endpoints. Internal agent routes
and private BFF headers are forbidden dependencies.

## Authentication

- `POST /api/user/login` for compatibility password login
- `POST /oauth/device/code` for RFC 8628 device authorization
- `GET /oauth/device` for browser verification and consent
- `POST /oauth/token` for device token polling and refresh
- `GET /api/user/userInfo` for session identity verification

## Stable command API

Commands must use JSON-compatible request and response bodies. Async generation
returns a `task_id`; callers use a status endpoint until completion. A CLI
command must never require a database, Redis, private model gateway, or local
Agent session.

The first public business commands are `task get` and `viral-replica create`;
their exact request schemas must be published before adding them to the CLI.
