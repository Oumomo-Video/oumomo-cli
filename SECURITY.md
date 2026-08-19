# Security

The public CLI never contains Oumomo server secrets, model prompts, internal
Agent context, database credentials, or production cookies.

Credential rules:

- Passwords are read only from a hidden TTY prompt and are never command-line arguments.
- OAuth access tokens are short-lived; refresh tokens are stored locally with restrictive permissions.
- MCP keys are treated as revocable machine credentials and are never printed after input.
- Bug reports must redact passwords, cookies, access tokens, refresh tokens, MCP keys, and private URLs.

Report security issues privately to the Oumomo maintainers before public disclosure.
