---
name: oumomo-product-detail-image
description: Use when the user wants TikTok Shop product main images or detail-page images.
version: "0.1.0"
---

# Product Detail Images

## Intent

Trigger for “生成商品主图”, “做详情图”, “TikTok Shop listing images”, or
“重做商品图片”。Do not trigger for simply describing an image, writing a
script, or creating a video.

## Required inputs

Collect one to nine product images and a short visual direction. Region and
language are required; ask for them if absent. Main image count defaults to 7,
detail image count is 1, and quality defaults to 1K. Supported regions are CN,
US, UK, and JP.

```text
请发商品图，并告诉我目标市场（CN/US/UK/JP）和想要的展示风格；主图默认 7 张、详情图 1 张、1K 画质。
```

## Commands

```bash
oumomo product-images create --file "<image>" \
  --region US --language EN_US --prompt "<visual direction>" \
  --main-count 7 --detail-count 1 --quality 1K --json

oumomo task get --id "<task-id>" --json
```

Poll the returned task ID. Do not expose private generation settings or claim
that images exist while the task is still running.
