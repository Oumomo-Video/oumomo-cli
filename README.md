# Oumomo CLI (public bootstrap)

The public, thin command-line client for Oumomo. It is intentionally **not**
an Agent runtime: it has no model, prompt, session memory, planner, database,
Redis, or hidden business context. It authenticates and calls documented
Oumomo APIs.

This repository is the clean public boundary. It includes credential storage,
password login compatibility, and OAuth Device Flow. OAuth becomes usable when
the corresponding public Oumomo endpoints are deployed.

## Install and build

```bash
npm install
npm run build
node dist/index.js --help
```

## Authentication modes

```bash
oumomo login --account user@example.com       # compatibility password login
oumomo auth login                             # OAuth Device Flow
oumomo mcp login --key omcp_...               # automation credential
oumomo auth status
oumomo logout
```

Password login, OAuth login, and MCP Key login are separate credential
providers. They share the account's Oumomo permissions and quotas, but a
machine key is not a human login and cannot manage account settings.

## Public boundary

This repository contains only the client and public contracts. Natural-language
planning, private Agent context, business prompts, memory, model routing, and
internal observability stay in Oumomo's hosted services or private repositories.
See [docs/architecture.md](docs/architecture.md) and [docs/api-contract.md](docs/api-contract.md).

## WorkBuddy

The submission package is under
`connectors/workbuddy/oumomo/`. It uses the CLI Device Flow and a small Skill
that describes deterministic commands. It does not ship Oumomo Agent context.
