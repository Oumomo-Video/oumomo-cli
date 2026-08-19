# Skill Migration Policy

The public skills are rewritten from the internal `feat/wyt` skills. They keep
only three things: intent examples, missing-input guidance, and documented CLI
commands. They deliberately omit internal tool names, agent-core state fields,
model prompts, private task parameters, and customer-specific workflow rules.

Initial public set:

- `oumomo-video-replica`
- `oumomo-script`
- `oumomo-product-detail-image`

The internal skills remain the source for the hosted Agent. Public skills are a
user-facing command guide, not a copy of the hosted Agent planner.
