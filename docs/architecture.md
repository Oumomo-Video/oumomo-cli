# Public Architecture

```text
User / WorkBuddy / script
          |
       oumomo CLI
          |
  documented Oumomo API
          |
 hosted Oumomo services
```

The CLI owns argument parsing, credential storage, transport, retries, and
stable JSON output. The hosted service owns authorization, company scope,
credits, rate limits, task orchestration, model selection, and private Agent
context.

The old `oumomo-agents` repository is not a dependency of this repository.
Its `agent-core` is an internal runtime and must not be copied into the public
CLI. Its skills may be published separately only after removing private
references, internal endpoints, prompts, fixtures, and customer data.

## Credential boundaries

- Password: interactive compatibility login that yields a session credential.
- OAuth: Device Authorization Flow for WorkBuddy and other public clients.
- MCP Key: revocable machine credential for scripts and MCP-compatible tools.

All three identify the same Oumomo account/company policy, but they are stored,
revoked, and displayed as separate sessions or credentials.
