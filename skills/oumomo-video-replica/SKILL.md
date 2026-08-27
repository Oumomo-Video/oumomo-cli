---
name: oumomo-video-replica
description: 通过 Oumomo CLI 从商品链接、品类或参考视频中推荐真实可访问的爆款视频；选定参考后收集商品图片、多角度白底图、复刻提示词和修改要求，确认生成参数并生成视频。
---

# Oumomo Viral Remake

## Trigger

Use for viral ecommerce references, TikTok/FastMoss reference URLs,
TikTok Shop/FastMoss product-detail URLs, `viral_video` selections, Link to
Video requests, and remake requests. Do not use for standalone scripts,
image-only generation, deduplication, or publishing.

## CLI

Run declared adapters with `oumomo-agent tool <name> --args '<JSON>'`.
Use `oumomo-agent image upload --file <path>` for local images. Do not call a
remote agent or chat endpoint.

## Tools

- `url_to_video_fetch_product` (only for product-detail URLs)
- `video_replica_search`
- `video_replica_generate_video`
- `replica_progress`
- `replica_project_result`

## Workflow

1. If the user provides a TikTok Shop/FastMoss product-detail URL, call
   `url_to_video_fetch_product` first and use its product/category context for
   `video_replica_search`.
2. For category requests, reference-video URLs, or a direct Link to Video
   request, translate a non-English category into a concise English ecommerce
   search term, then call `video_replica_search` as appropriate. Every displayed
   recommendation must include its real `videoUrl`, `embedUrl`, or `url` as a
   clickable/copyable link. Describe recommendations briefly using the returned
   metadata and the user's actual product context.
   If no usable link exists, ask for a reference URL.
3. Reuse product images already available in the current conversation. If no
   product image is available, ask for one. A clean multi-angle white-background
   image set is preferred but optional. Ask whether the user wants to provide a
   remake Prompt or any changes; both are optional.

   Chinese collection copy when product images already exist: `已收到商品图。你也可以补充多角度白底图、复刻 Prompt 或想调整的地方；这些都可以不填，我会根据参考视频和现有商品素材整理生成方案，再给你确认。`
4. If the user provides a remake Prompt, preserve it and apply their requested
   changes. Otherwise, create the Prompt from the selected reference analysis
   and available product materials. Use an empty `userRequirements` value when
   the user has no additional changes.
5. Show seconds, language, ratio, quality, generation mode, Prompt, and video
   description together for confirmation. Call
   `video_replica_generate_video` once after structured confirmation,
   passing the confirmed Prompt as `replicaPrompt` and requested changes as
   `userRequirements`,
   then poll with `replica_progress` and `replica_project_result`.
