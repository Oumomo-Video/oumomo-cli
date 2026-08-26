# Security

The public CLI never contains Oumomo server secrets, model prompts, internal
Agent context, database credentials, or production cookies.

Credential rules:

- Authentication starts in the browser through `oumomo-agent setup`.
- OAuth access tokens and session cookies are stored locally with restrictive permissions.
- Credentials are never accepted as command-line arguments or printed in CLI output.
- Bug reports must redact cookies, access tokens, refresh tokens, and private URLs.

Report security issues privately to the Oumomo maintainers before public disclosure.
