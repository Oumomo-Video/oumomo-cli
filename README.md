# Oumomo Video Agent

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
请安装并使用 Oumomo Video Agent，帮我完成爆款视频复刻和商品链接生成视频。

Skill：https://github.com/Oumomo-Video/oumomo-cli/tree/main/skills/oumomo-video-replica
CLI：npm install -g oumomo-agent && oumomo-agent setup

请先安装 Skill 和 CLI，并让我在浏览器完成 Oumomo 登录。之后严格按照 Skill 调用 oumomo-agent：根据我的商品链接、品类或参考视频推荐真实可访问的爆款视频；确认参考方向和商品素材后，整理复刻 Prompt 与生成参数供我确认；只有在我明确确认后才提交视频生成。不要调用远程 Agent 或 Chat 接口。
```

The published skill is available at
[`skills/oumomo-video-replica`](skills/oumomo-video-replica/SKILL.md).

## Viral video remake

Start with a product category, product link, or a reference video:

```text
帮我找适合美白牙贴的美国 TikTok 爆款视频，并复刻一条带货视频。
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

Product links:

- [https://vt.tiktok.com/ZSVVr1T8A/](https://vt.tiktok.com/ZSVVr1T8A/)
- [https://vt.tiktok.com/ZSVVr2gaA/](https://vt.tiktok.com/ZSVVr2gaA/)
- [https://vt.tiktok.com/ZSVVMt7wT/](https://vt.tiktok.com/ZSVVMt7wT/)

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
