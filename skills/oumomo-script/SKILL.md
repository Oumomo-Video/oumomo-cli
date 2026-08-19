---
name: oumomo-script
description: Use when the user wants a product video script, hooks, or voiceover text rather than a rendered video.
version: "0.1.0"
---

# Product Script

## Intent

Trigger for “写脚本”, “写口播”, “给我几个 hook”, “write a product video
script”, or “voiceover”。Do not trigger for a request to render a video or
generate product images.

## Required inputs

Ask for the product or product URL and the target audience. Region, language,
duration, and tone are optional; if missing, ask one compact clarification
question instead of inventing product claims.

```text
为了写得准确，请给我商品名称或商品链接；如果有目标市场、时长和语气也一起告诉我。
```

## Command

```bash
oumomo script create --product "<product-or-url>" \
  --region US --language EN_US --duration 30 --tone UGC --json
```

Return the generated text and any task ID exactly as provided by the public
API. Do not expose internal prompts or tool names.
