# Oumomo Agent CLI

`oumomo-agent` is a thin Node.js 20+ client for the published
`oumomo-video-replica` skill. It stores the local OAuth session, uploads image
files, and forwards allowlisted tool calls to Oumomo's hosted API.

It only includes browser login, local credential storage, image upload, and
allowlisted HTTP tool calls. All business execution stays on Oumomo servers.

## Install

```bash
npm install
npm run build
node dist/bin.js --help
```

The package has zero production dependencies. A release tarball can be
installed without npm registry authentication:

```bash
npm install -g ./oumomo-agent-0.1.0.tgz
oumomo-agent setup
```

Before the first release tarball is uploaded, the current GitHub branch can be
installed directly:

```bash
npm install -g github:Oumomo-Video/oumomo-cli
oumomo-agent setup
```

## Login and tools

```bash
oumomo-agent setup
oumomo-agent auth status
oumomo-agent tool list
oumomo-agent tool describe video_replica_search
oumomo-agent tool video_replica_search --args '{"category":"lipstick","region":"US"}'
```

Generation requires explicit confirmation:

```bash
oumomo-agent tool video_replica_generate_video \
  --confirm \
  --args '{"videoId":"...","productImageFileNo":"...","seconds":30}'
```

The server, not this client, owns authentication policy, tool allowlists,
model routing, prompts, billing, and task orchestration.

## Skill

Install `skills/oumomo-video-replica` into the user's Codex skills directory.
The skill is the only published workflow in this repository.

## Service requirement

The Oumomo API must expose `/api/cli/*` before tool calls work. Until that
server route is deployed, the client can be installed and authenticated but
tool requests will return HTTP 404.
