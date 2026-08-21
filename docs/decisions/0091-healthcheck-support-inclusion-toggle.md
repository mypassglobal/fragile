# 0091 — Healthcheck support-inclusion toggle excludes support from the denominator

**Date:** 2026-08-21
**Status:** Accepted
**Deciders:** Architect Agent, Developer Agent
**Proposal:** docs/proposals/0085-healthcheck-support-toggle-board-filter-tz-cutoff.md

## Context

The weekly Healthcheck (ADR 0070) scores Stability and Roadmap against a shared denominator
`D` — all tickets whose first-ever start transition fell in the week — which includes reactive
support tickets. Support work is unplanned and unlinked by nature, so support-heavy weeks depress
both scores and obscure how well *planned* work was planned and roadmapped. Teams asked for an
optional way to strip support out and see planned-work quality in isolation. The change must not
alter the default view (existing dashboards and shared links).

## Options Considered

### Option A — Numerator-only exclusion
Keep support tickets in `D` but never count them toward the Stability/Roadmap numerator.
- **Cons:** This *penalises* the score (support tickets sit in the denominator as permanent
  "misses") rather than removing them from the question. Not what "exclude support" means.

### Option B — Exclude from denominator and numerators (chosen)
When the toggle is off, remove support tickets from the Stability and Roadmap denominator **and**
numerators, so the score becomes `planned-non-support / started-non-support`. The Support
dimension keeps the full denominator and is never affected.
- **Pros:** Scores exactly the planned-work-quality question on planned work; Support metric
  stays a faithful reactive-load measure; pooling across boards remains correct because each
  board's reduced denominator/numerator is summed as before.

## Decision

1. `GET /api/healthcheck` accepts `includeSupport` (boolean, default `true`). `true` is
   byte-for-byte the historical behaviour.
2. When `false`, support tickets are excluded from the **Stability & Roadmap denominator and
   numerators**; the Support dimension is unaffected (full denominator).
3. The flag applies uniformly to the selected-week scores **and** the 8-week trend so the two
   never disagree. The included-tickets list is unchanged (all started tickets listed, with
   flags).
4. The flag is surfaced in the UI as a URL-param toggle (`?includeSupport=false`) so the choice
   is shareable and reload-safe, and on the `get_healthcheck_report` MCP tool (forwarded only
   when explicitly false).

## Consequences

- Default dashboards, links, and MCP calls are unchanged.
- With the toggle off, a board whose entire started set is support contributes a zero
  Stability/Roadmap denominator and therefore N/A (consistent with the existing empty-denominator
  semantics), rather than a misleading 0%.
- Two related items shipped in the same change are not architectural and are recorded only in the
  proposal: the included-tickets board filter (client-side, reuses the `BoardChip` pattern) and
  the frontend timezone week-cutoff bug fix (thread the configured timezone through
  `currentIsoWeek`/`lastCompletedWeek`; backend was already timezone-correct).
