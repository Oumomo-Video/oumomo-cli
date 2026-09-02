# Oumomo CLI and Skills Distribution

Status: approved target architecture, not fully migrated yet.

## Decision

Oumomo will follow the same public distribution split used by Higgsfield:

1. A dedicated CLI repository for user-facing documentation, installers, and
   release artifacts.
2. A dedicated Skills repository containing the installable Agent skills.

The CLI and Skills are separate products with separate installation steps.

## Target repositories

### `Oumomo-Video/oumomo-cli`

Public distribution repository. Its target contents are limited to:

```text
README.md
README.zh-CN.md
LICENSE
install.sh
install.ps1
release metadata
```

The primary CLI installation channel is npm:

```bash
npm install -g oumomo-agent
```

The public repository may also contain `install.sh`, `install.ps1`, checksums,
and GitHub Release artifacts as alternate installation channels. It does not
contain the CLI implementation source. The npm package contains only the
installable CLI artifact needed on the user's machine.

This public repository must not expose the Oumomo Agent harness, server-side
prompts, model credentials, business adapters, or internal runtime.

The current repository still contains the Node.js TypeScript implementation.
That is an interim state. The source must be moved to a private build source
before the public repository is reduced to installers, documentation, and
release artifacts.

### `Oumomo-Video/oumomo-skills`

Dedicated public Skills repository. Target structure:

```text
README.md
LICENSE
oumomo-video-replica/
├── SKILL.md
└── agents/
    └── openai.yaml
```

The first published Skill is `oumomo-video-replica`. It covers both viral
video remake and product-link-to-video workflows. Do not split those workflows
into separate Skills.

The target repository has not been created yet. Until migration is complete,
the canonical Skill remains at:

```text
https://github.com/Oumomo-Video/oumomo-skill/tree/main/skills/oumomo-video-replica
```

## Target user installation

The user gives these instructions to Codex or another compatible Agent:

```text
Set up Oumomo for me so I can remake viral ecommerce videos and turn product links into videos from here.

1. Install the CLI by running `npm install -g oumomo-agent`.
2. Authenticate by running `oumomo-agent auth login` and complete sign-in in the browser it opens.
3. Install the companion Skill by running `npx skills add Oumomo-Video/oumomo-skills`.

Once that is done, let me know when it is ready.
```

The intended command sequence is:

```bash
npm install -g oumomo-agent
oumomo-agent auth login
npx skills add Oumomo-Video/oumomo-skills
```

An install script or GitHub Release may be provided as a fallback, but it is
not the primary installation path.

## Authentication boundary

The browser login is an OAuth device flow added alongside the existing Oumomo
website Cookie login. It must not replace or break website login.

The CLI should use a short-lived OAuth Bearer token for Oumomo API calls. The
OAuth token exchange must not export the website session Cookie to the user
device. Tokens must support expiration and revocation.

## Migration checklist

- [ ] Create `Oumomo-Video/oumomo-skills`.
- [ ] Move `oumomo-video-replica` to the Skills repository.
- [ ] Verify `npx skills add Oumomo-Video/oumomo-skills` installs the Skill.
- [ ] Produce the installable CLI artifact for macOS, Windows, and Linux.
- [ ] Move CLI source to a private build repository.
- [ ] Publish the corrected CLI artifact to npm.
- [ ] Optionally add signed/checksummed GitHub Releases and fallback installers.
- [ ] Change setup UX to `oumomo-agent auth login` while preserving a compatible alias if needed.
- [ ] Make CLI business requests use OAuth Bearer tokens rather than website Cookies.
- [ ] Validate login, image upload, viral search, confirmed generation, progress,
      and result retrieval on clean macOS and Windows machines.
- [ ] Update public READMEs only after the new repository and installers exist.

## Current interim installation

Until the migration checklist is complete, development testing continues with:

```bash
npm install -g /path/to/oumomo-agent-0.1.2.tgz
oumomo-agent setup
```

Install the interim Skill from its current GitHub subdirectory with the Agent's
supported Skill installer. Do not direct users to `npm install
oumomo-agent@0.1.2` until that exact version is published to npm. The final
`npx skills add Oumomo-Video/oumomo-skills` command must be verified after the
dedicated Skills repository exists.

Do not present the interim Node.js package as a native binary. Do not change
the public README to the target commands before the corresponding artifacts
and Skills repository are available.

## Repeatable clean-room testing

Use Docker for a new Linux and Node.js 20 environment on every run. The
container does not mount the host HOME and is deleted on exit.

```bash
# Install the tarball and run non-authenticated smoke checks.
npm run test:clean

# Complete browser login against test, then use an interactive disposable shell.
./scripts/clean-room-test.sh login

# Enter a fresh shell with the CLI installed but no credentials.
./scripts/clean-room-test.sh shell
```

In `login` mode, copy the URL printed by the container into the host browser.
After authorization, run search, upload, and other CLI tests in the container.
Typing `exit` destroys both the container and its Oumomo credentials.

Override inputs when needed:

```bash
OUMOMO_CLI_ARTIFACT=/absolute/path/oumomo-agent.tgz \
OUMOMO_CLI_TEST_API_URL=https://test.oumomo.ai \
./scripts/clean-room-test.sh login
```

This covers a clean Linux user environment. A temporary HOME can cover clean
macOS user-state behavior, but Windows still needs CI or a Windows virtual
machine for final platform validation.
