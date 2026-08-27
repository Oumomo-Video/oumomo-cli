# Oumomo CLI

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm 版本](https://img.shields.io/npm/v/oumomo-agent.svg)](https://www.npmjs.com/package/oumomo-agent)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![开源协议：MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

在你常用的 AI 智能体里，把经过市场验证的热门内容变成属于自己商品的新视频。

Oumomo 为 Codex 及其他支持技能的智能体提供两套完整的视频生产流程：

- **爆款视频复刻**：发现与商品匹配的高表现参考视频，选择创意方向，确认素材和生成参数，然后为你的商品生成新视频。
- **商品链接生成视频**：提供 TikTok Shop 或 FastMoss 商品链接，由智能体理解商品信息、匹配热门参考，并整理可直接生成的视频方案。

智能体负责与你沟通，`oumomo-agent` 负责安全登录、上传商品图片和调用经过授权的 Oumomo 工具。无需配置 OpenAI API Key 或 MCP Key。

## 快速开始

需要安装 [Node.js 20 或更高版本](https://nodejs.org/)。

```bash
npm install -g oumomo-agent && oumomo-agent setup
```

安装完成后会自动打开 Oumomo 登录页面。在浏览器完成一次登录，即可返回智能体继续使用。

## 安装技能

将下面这段话直接发给 Codex 或其他支持技能的智能体：

```text
请安装并使用 Oumomo CLI，帮我完成爆款视频复刻和商品链接生成视频。

1. 安装 CLI：运行 `npm install -g oumomo-agent`。
2. 登录 Oumomo：运行 `oumomo-agent setup`，并让我在打开的浏览器中完成登录。
3. 安装配套 Skill：运行 `npx skills add Oumomo-Video/oumomo-skill`。

完成后重启 Agent，并告诉我是否已经准备好。之后严格按照 Skill 调用 oumomo-agent：根据我的商品链接、品类或参考视频推荐真实可访问的爆款视频；确认参考方向和商品素材后，整理复刻 Prompt 与生成参数供我确认；只有在我明确确认完整参数后才提交视频生成。不要调用远程 Agent 或 Chat 接口。
```

安装已发布的 Skill：

```bash
npx skills add Oumomo-Video/oumomo-skill
```

## 爆款视频复刻

你可以从商品品类、商品链接或一条参考视频开始：

```text
帮我找适合美白牙贴的美国 TikTok 爆款视频，并复刻一条带货视频。
```

Oumomo 会依次完成：

1. 推荐与商品匹配且可直接访问的参考视频。
2. 由你选择想要复刻的创意方向。
3. 复用对话中已有的商品图片，素材不足时再请你上传。
4. 接收可选的多角度白底图、复刻提示词和修改要求。
5. 集中展示时长、语言、画幅、画质、生成模式和最终提示词。
6. 仅在你明确确认后提交生成，并持续跟进任务直至完成。

## 商品链接生成视频

发送支持的 TikTok Shop 或 FastMoss 商品详情链接，Oumomo 会读取商品信息、推荐相关爆款参考，并整理视频方案供你确认。

## 用参考视频开始复刻

把下面任意一条 TikTok 参考视频和商品图片发给智能体，即可直接开始爆款复刻：

- [体验参考视频 1](https://vt.tiktok.com/ZSVVr1T8A/)
- [体验参考视频 2](https://vt.tiktok.com/ZSVVr2gaA/)
- [体验参考视频 3](https://vt.tiktok.com/ZSVVMt7wT/)

## 由你决定

- 参考视频和创意方向
- 商品图片及可选的多角度白底图
- 可选的复刻提示词和修改要求
- 时长、语言、画幅、画质和生成模式
- 任何付费生成任务提交前的最终确认

## 常用命令

通常只需让已安装的技能操作命令行工具。排查登录或工具状态时，也可以直接运行：

```bash
oumomo-agent auth status
oumomo-agent tool list
oumomo-agent tool describe video_replica_search
```

`oumomo-agent` 是一个零生产依赖的轻量客户端，不会向用户设备分发 Oumomo 的模型、提示词、适配器或智能体运行时；所有业务任务均在 Oumomo 服务端执行。

## 开源协议

[MIT](LICENSE)
