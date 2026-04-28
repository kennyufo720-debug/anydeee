---
name: model-tier
description: Switch the active model tier for Claude sub-agent tasks. Use this skill whenever the user says "/model-tier", "switch to haiku/sonnet/opus", "use a faster model", "use a cheaper model", "change model level", "switch to tier 1/2/3", "use light/standard/deep mode", or wants to control cost vs. capability tradeoffs for subsequent Claude tasks. Also trigger when the user mentions wanting faster responses, wanting deeper reasoning, or wanting to conserve API usage.
argument-hint: <tier>  —  1 | light | haiku   |   2 | standard | sonnet   |   3 | deep | opus
disable-model-invocation: true
allowed-tools: Write, Read, Bash
---

# Model Tier Switch

The user wants to change which Claude model tier handles subsequent sub-agent tasks.

**Note:** The main session model cannot be changed mid-conversation. This skill sets a preference that governs all future `Agent` sub-task invocations — every time Claude spawns a sub-agent to handle a task, it will use the saved tier.

---

## Step 1 — Parse the argument

Argument received: `$ARGUMENTS`

Map to a tier (case-insensitive, trim whitespace):

| Input | Tier | Model ID | Label |
|-------|------|----------|-------|
| `1`, `light`, `haiku` | 1 | `claude-haiku-4-5-20251001` | Light |
| `2`, `standard`, `sonnet` | 2 | `claude-sonnet-4-6` | Standard |
| `3`, `deep`, `opus` | 3 | `claude-opus-4-6` | Deep |

If the argument is empty or unrecognized, skip to **Step 4 (show menu)** instead of writing a preference.

---

## Step 2 — Save preference

Write `.claude/model-tier.json` in the current project root (create `.claude/` if needed):

```json
{
  "tier": <1|2|3>,
  "label": "<light|standard|deep>",
  "model": "<model-id>",
  "set_at": "<ISO 8601 timestamp>"
}
```

---

## Step 3 — Confirm to user

Output this block (fill in the blanks):

```
✓ 模型層級已切換

  層級：Tier <N> — <Label>
  模型：<model-id>
  適合：<use-cases from table below>

後續所有子任務將以此模型執行，直到再次切換。
```

Use-case descriptions per tier:
- **Light (Haiku):** 快速搜尋、簡單編輯、格式轉換、Q&A、grep 類任務
- **Standard (Sonnet):** 一般程式開發、分析、中等複雜度任務（預設）
- **Deep (Opus):** 複雜推理、架構設計、長篇研究、多步驟規劃

---

## Step 4 — Show menu (no/invalid argument only)

If no valid argument was given, display the tier table and prompt:

```
請選擇模型層級：

  /model-tier 1   (light)     →  Haiku   — 快速、省成本
  /model-tier 2   (standard)  →  Sonnet  — 均衡（預設）
  /model-tier 3   (deep)      →  Opus    — 深度推理

目前層級：<read from .claude/model-tier.json, or "Standard (預設)" if file missing>
```

---

## Applying the tier in practice

After this skill runs, when Claude spawns sub-agents via the `Agent` tool:

- **Tier 1 (Haiku):** add `"model": "haiku"` to every Agent call. Keep prompts lean — Haiku excels at focused, single-step tasks.
- **Tier 2 (Sonnet):** add `"model": "sonnet"` (or omit — Sonnet is the default). Normal usage.
- **Tier 3 (Opus):** add `"model": "opus"` to every Agent call. Give rich context — Opus benefits from thorough background.

To check the active tier at any time: read `.claude/model-tier.json`.
To reset: `/model-tier 2` or `/model-tier standard`.
