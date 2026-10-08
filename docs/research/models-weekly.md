# Models Weekly (2026-10-01)

## Owner override (2026-10-08): all worker tasks go to Claude Haiku 5.5, effort high
Until the owner says otherwise, every new dispatch uses the Agent tool with `model: haiku` and `effort: high`. This replaces the table below for new tasks. Tasks already running keep their current platform.

## Routing 2026-10-01 (superseded by the override above; director-verified: each id answered a test call)
| Role | First choice (free) | Fallback (credit) |
|---|---|---|
| implementer, refactorer | Claude sonnet subagent (sub) | Codex after weekly reset |
| bug-fixer, code-reviewer, playtester | `opencode/space-bunny-free` | `google-vertex/gemini-2.5-flash` |
| writer (adult) | `opencode/longcat-2.5-preview-free` | OpenRouter (test refusals first) |
| researcher (big reads) | `google-vertex/gemini-2.5-pro` (SGD381 trial) | `opencode/longcat-2.5-preview-free` |
| analyzer, doc-keeper | `google-vertex/gemini-2.5-flash` | `opencode/space-bunny-free` |
| model scout | Claude haiku subagent (web tools) | none |
Notes: Zen free models need no key and no Console funds. Space Bunny on OpenRouter is capped at 200 req/day. Z.ai uses 5-hour and weekly quotas, not a daily one; it needs an API key the owner enters in the OpenCode app.

## Scout notes (raw, from T-006; ranks/prices unverified)
### Scout routing suggestion

| Role | Model | Where | Cost/1M |
|------|-------|-------|---------|
| Implementer | Qwen3-Coder:free | OpenRouter | $0/$0 |
| Bug-fixer | Space Bunny Alpha | OpenRouter | $0/$0 |
| Refactorer | LongCat 2.0 | OpenRouter | $0.30/$1.20 |
| Code-reviewer | Space Bunny Alpha | OpenRouter | $0/$0 |
| Researcher | Gemini 2.0 Flash Exp | OpenRouter | $0/$0 |
| Analyzer | Claude Haiku 4.5 | OpenRouter | $1/$5 |
| Writer | LongCat 2.5 Preview | OpenCode | $0/$0 |
| Playtester | Space Bunny Alpha | OpenRouter | $0/$0 |
| Doc-keeper | Gemini 3.1 Flash Lite | OpenRouter | $0.25/$1.50 |

## Findings

**Space Bunny:** Anonymous stealth model (likely MiniMax), 1M context, free on OpenRouter with 200 req/day limit before $10 spend; OpenCode version has zero data retention, no training on prompts. (https://openrouter.ai/stealth/space-bunny-alpha, 2026-09-23)

**LongCat 2.5 Preview:** Meituan 1.6T MoE, free on OpenCode since 2026-09-26 with no published end date, 1M context, zero data retention, multimodal. Replaces paid LongCat 2.0 ($0.30/$1.20) for long-context tasks. (https://pi.dev/models/opencode/longcat-2-5-preview-free, 2026-09-26)

**Z.ai GLM:** Switched to 5-hour/weekly credit quotas (not daily tokens). Team plan: 60M/300M tokens/week (Standard, GLM-5.3); peak hours 14:00–18:00 SGT consume 3× quota. API key integration with OpenCode requires user entry per DEVPACK docs. (https://docs.z.ai/devpack/notice/usage-revision, 2026-07-30)

## Owner Questions

1. **Writer role (adult fiction):** Both Claude and Gemini refuse explicit sexual content by policy. Use LongCat for uncensored narrative, or accept policy refusals? [Recommend: LongCat for creative freedom]

2. **Data retention flags:** DeepSeek trains on prompts (Chinese data center). Use cheaper non-training routes (Fireworks/Together) instead? [Recommend: Skip DeepSeek, use Qwen/Gemini]

3. **Space Bunny limits:** 200 req/day on free tier until $10 spend. Suitable for playtesting, or too constrained? [Recommend: Accept for playtests under 200/day, upgrade on $10 spend]

4. **Z.ai API key entry:** CLAUDE.md forbids ai-settings.json edits. Can user add GLM key to local OpenCode config, or off-limits? [Recommend: Clarify OpenCode config scope with user]
