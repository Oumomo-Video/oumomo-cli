# Oumomo CLI

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/oumomo-agent.svg)](https://www.npmjs.com/package/oumomo-agent)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

Turn proven ecommerce content into your next product video, directly from your
AI agent.

Oumomo gives Codex and other skill-compatible agents two production workflows:

- **Viral video remake**: discover relevant high-performing reference videos,
  choose a direction, confirm the creative and generation settings, then create
  a new video for your product.
- **Product link to video**: provide a supported TikTok Shop or FastMoss product
  link and let the agent collect the product context, find suitable references,
  and prepare a ready-to-generate video plan.

The agent handles the conversation. `oumomo-agent` handles secure sign-in,
product image uploads, and approved Oumomo tool calls. No OpenAI API key or MCP
key is required.

## Get started

Requires [Node.js 20 or later](https://nodejs.org/).

```bash
npm install -g oumomo-agent && oumomo-agent setup
```

The setup command opens Oumomo in your browser. Sign in once, then return to
your agent.

## Install the skill

Give the following message to Codex or another skill-compatible agent:

```text
Install and use Oumomo CLI to help me remake viral ecommerce videos and turn product links into new videos.

Skill: https://github.com/Oumomo-Video/oumomo-skill/tree/main/oumomo-video-replica
CLI: npm install -g oumomo-agent && oumomo-agent setup

Install the Skill and CLI first, then let me sign in to Oumomo in my browser. Follow the Skill and use oumomo-agent to recommend accessible viral reference videos from my product link, category, or reference video. After I choose a direction and provide product assets, prepare the remake prompt and generation settings for my review. Submit a generation request only after I explicitly confirm it. Do not call a remote Agent or Chat endpoint.
```

Install the published Skill with:

```bash
npx skills add Oumomo-Video/oumomo-skill
```

## Viral video remake

Start with a product category, product link, or a reference video:

```text
Find high-performing US TikTok references for teeth-whitening strips and remake one as a product video.
```

Oumomo will:

1. Recommend relevant reference videos with accessible links.
2. Let you choose the creative direction.
3. Reuse product images from the conversation or ask you to upload them.
4. Accept optional multi-angle white-background images, a remake Prompt, and
   requested changes.
5. Present duration, language, aspect ratio, quality, generation mode, and the
   final Prompt for confirmation.
6. Generate only after your explicit confirmation, then track the task through
   completion.

## Product link to video

Send a supported TikTok Shop or FastMoss product-detail URL to let Oumomo read
the product context, recommend relevant viral references, and prepare the video
for your approval.

## Try a reference video

Send one of these TikTok reference links together with your product image to
start a viral remake directly:

- [Try reference video 1](https://vt.tiktok.com/ZSVVr1T8A/)
- [Try reference video 2](https://vt.tiktok.com/ZSVVr2gaA/)
- [Try reference video 3](https://vt.tiktok.com/ZSVVMt7wT/)

## What you control

- Reference video and creative direction
- Product images and optional multi-angle white-background images
- Optional remake Prompt and modification requirements
- Duration, language, aspect ratio, quality, and generation mode
- Final confirmation before any paid generation request

## CLI commands

Most users can let the installed skill operate the CLI. These commands are also
available for inspection and troubleshooting:

```bash
oumomo-agent auth status
oumomo-agent tool list
oumomo-agent tool describe video_replica_search
```

`oumomo-agent` is a lightweight client with zero production dependencies. It
does not ship Oumomo models, prompts, adapters, or agent runtime code; business
execution remains on Oumomo servers.

## License

[MIT](LICENSE)
