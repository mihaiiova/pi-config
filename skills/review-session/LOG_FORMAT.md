# Revision Log Format

Each review writes one file to the current project's `revision-log/` directory.

## File name

`YYYY-MM-DD-<short-slug>.md`

## Template

```markdown
# Review: [context]
**Date:** YYYY-MM-DD
**Session:** [what was developed]

## History Checked
- [Filename, or `No prior revision logs`]

## Recurring Patterns
- [Pattern and supporting log filenames, or `None found`]

## Scores
| Dimension | Score |
|-----------|-------|
| Friction | X.X |
| Repetition | X.X |
| Missing capability | X.X |
| Knowledge gap | X.X |
| Fragility | X.X |

## Suggestions
| # | Category | Suggestion | Score | Accepted? |
|---|----------|------------|-------|-----------|
| 1 | documentation | ... | 0.X | ✅ |

## Changes Made
- [Concrete artifact for each accepted suggestion]

## Notes
- [Signals, rejection rationale, or follow-up]
```
