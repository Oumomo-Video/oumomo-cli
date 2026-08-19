---
name: oumomo-public-catalog
description: Discover which Oumomo commerce content capabilities are publicly available before selecting a specialized skill.
version: "0.1.0"
---

# Oumomo Public Catalog

Use `oumomo capabilities list --json` when the user asks what Oumomo can do or
when several Oumomo capabilities could match. Select a specialized skill only
when its `availability` is `ready`. For `preview` capabilities, explain that the
public connector is not enabled yet; do not fabricate a command result or fall
back to a private tool.

Route obvious intents directly:

- 复刻参考视频 -> `oumomo-video-replica`
- 只写脚本/口播/hook -> `oumomo-script`
- 商品主图/详情图 -> `oumomo-product-detail-image`

For all other catalog items, check availability first.
