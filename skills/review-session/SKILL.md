---
name: review-session
description: Session retrospective. Use when a development round ends or the user asks to review how the agent worked. Scores workflow signals, checks recent revision logs for recurring patterns, and implements accepted improvements.
---

# Review Session

Review how we worked in the current development round. Improve process, tools, organization, documentation, prompts, and architecture—not product scope.

## 1. Gather signals

Read the current conversation. Then inspect up to the five newest files in `revision-log/` at the current project root. If none exist, record that history is unavailable.

A prior entry is evidence of recurrence only when it names the same underlying problem. Do not create a suggestion from history alone: the current session needs its own signal.

## 2. Score

Rate every dimension from `0.0` to `1.0`. A score above `0.6` earns one suggestion.

- **Friction** — time lost to unclear code, poor discoverability, missing tools, or cumbersome workflows. `0.6`: a change would recover significant effort; `0.8+`: major time sink.
- **Repetition** — unnecessary repeated actions, explanations, or searches. `0.6`: the same pattern occurred three or more times; `0.8+`: pervasive.
- **Missing capability** — a concrete skill, MCP server, tool, or script would materially improve the work. `0.6`: a nameable capability would save substantial effort; `0.8+`: its absence limited what was possible.
- **Knowledge gap** — missing or unclear documentation, architecture decisions, or conventions. `0.6`: we had to rediscover knowledge that should be recorded; `0.8+`: it caused significant lost time.
- **Fragility** — a concrete risk likely to break or block future work. `0.6`: identifiable trigger; `0.8+`: likely within the next two development rounds.

## 3. Report and decide

Report all scores, then only suggestions above `0.6`. Every suggestion needs a current-session signal, a concrete change, and a category: `skills`, `mcps`, `organization`, `prompts`, `architecture`, `documentation`, or `other`.

State the history checked and any recurring pattern found in the last five entries. Cite the relevant log filenames for a recurrence.

Ask the user to accept or reject each suggestion. Implement each accepted suggestion immediately. Completion requires a concrete artifact for every accepted suggestion: an edited, created, or deleted file; a GitHub issue; or a commit.

If nothing crosses the threshold, say `No significant improvement opportunities found.`

## 4. Log

Write `revision-log/YYYY-MM-DD-<slug>.md` in the current project. Create the directory if needed. Read [LOG_FORMAT.md](LOG_FORMAT.md) before writing.
