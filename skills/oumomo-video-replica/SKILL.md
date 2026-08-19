---
name: oumomo-video-replica
description: Use when the user wants to remake a TikTok or FastMoss reference video with their own product.
version: "0.1.0"
---

# Viral Replica

## Intent

Use this skill for “复刻这条视频”, “爆款复刻”, “remake this TikTok”, or
“找一个爆款参考”。Do not use it when the user only wants written script text
or a standalone product image.

## Required inputs

Before creating a task, collect: reference video URL, product image path or
public upload reference, target region, output language, and duration. Ask only
for missing values. Supported duration is 10, 15, or 30 seconds; if the user
does not specify it, ask for confirmation with 15 seconds as the suggestion.

Example guidance:

> 我可以帮你做爆款复刻。请提供参考视频 URL 和商品图；另外告诉我目标市场、语言和时长（10/15/30 秒）。

## Commands

```bash
oumomo viral-replica create \
  --reference "<video-url>" --image "<product-image>" \
  --region US --language EN_US --duration 15 --json

oumomo task get --id "<task-id>" --json
```

The create command returns a `task_id`. Poll `task get` until the task is
completed or failed. Never claim completion before the status response says so.
