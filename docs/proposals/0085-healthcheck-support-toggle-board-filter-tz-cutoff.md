# 0085 — Healthcheck: support-inclusion toggle, tickets board filter, timezone week cutoff

**Date:** 2026-08-21
**Status:** Accepted
**Author:** Architect Agent
**Related feature:** docs/features/0026-healthcheck-support-toggle-board-filter-tz-cutoff.md
**Related ADRs:** builds on 0070 (Healthcheck model), 0074 (org-wide pooling), 0050 (canonical ISO-week utils); proposes 0091

## Problem Statement

Three issues on the weekly Healthcheck report:

1. **No support toggle.** Stability and Roadmap score against a denominator (`D` = tickets whose
   first-ever start transition fell in the week) that includes reactive support tickets. Support
   work is unplanned and unlinked by nature, so support-heavy weeks depress both scores and hide
   how well *planned* work was planned and roadmapped.
2. **Included-tickets table has no board filter.** The table pools every board's tickets with no
   way to focus on one — unlike the gaps and unplanned-done tables, which already have an
   All/per-board chip filter.
3. **Week cutoff bug.** The frontend defaults to "last completed week" using `new Date()` read in
   UTC (`frontend/src/lib/iso-week.ts` — `currentIsoWeek` / `lastCompletedWeek`). The backend
   already computes week boundaries in the configured timezone (`backend/src/lib/iso-week.ts`,
   threaded via `HealthcheckService`). Near a week boundary (Sunday night in Australia/Sydney,
   UTC+10/+11) the two disagree and the page defaults to the wrong week.

## Proposed Solution

### 1. Support-inclusion toggle (default on)

Add `includeSupport` (boolean, default `true`) to `GET /api/healthcheck`. When `true`, behaviour
is byte-for-byte unchanged. When `false`, support tickets are removed from the **denominator and
the numerators** of Stability and Roadmap — score becomes
`planned-non-support / started-non-support`. The Support score is **never** affected by the flag.

- `computeBoardHealthcheck` (`healthcheck-compute.ts`) already classifies each started ticket's
  `support` flag. When `includeSupport === false`, exclude `support` tickets when accumulating the
  Stability/Roadmap `numerator` **and** `denominator`; Support's own dimension keeps the full
  denominator. Tickets list is unchanged (all started tickets still listed, with flags).
- The flag flows through the per-board resolver and pooling unchanged — pooling already sums
  per-board numerators/denominators, so excluding support per board pools correctly.
- Applied uniformly to the selected week **and** the 8-week trend so they never disagree.

DTO: `HealthcheckQueryDto` gains an optional `includeSupport` boolean (`@IsOptional`,
`@Type`/transform for the query string, default `true` in the service).

Frontend: a toggle on the page, URL-param driven (`?includeSupport=false` present ⇒ off, absent ⇒
on), passed to `getHealthcheck`.

### 2. Included-tickets board filter (frontend only)

Reuse the existing `BoardChip` All/per-board pattern (as in `gaps/page.tsx`). The chips filter the
already-loaded `tickets` array client-side by `boardId`; "All" shows every board. No backend
change. Board list comes from the tickets themselves (distinct `boardId`s present) so the filter
only shows boards that actually contributed that week.

### 3. Timezone week cutoff (frontend only)

The Healthcheck page fetches the server timezone via `getAppConfig().timezone` (same pattern as
`planning/page.tsx`) and computes the default/last-completed week in that timezone. Backend is
already correct and unchanged.

- Add a `tz` parameter to the frontend `currentIsoWeek` / `lastCompletedWeek` helpers (default
  `'UTC'` to preserve existing callers), deriving the "now" calendar date in the given IANA zone
  via `Intl.DateTimeFormat` parts (mirroring the backend `dateParts` approach) before the existing
  ISO-week arithmetic. The page passes the fetched timezone.

### 4. MCP tool (required, not deferred — CLAUDE.md MCP rules)

`get_healthcheck_report` calls `GET /api/healthcheck`. Add an optional `includeSupport` boolean to
its input schema, forward it to the backend only when explicitly set, update the tool description,
add a test asserting it is forwarded when set and **not** forwarded when unset, update the tool
table in `apps/mcp/README.md`, and bump `apps/mcp/package.json` version.

## Acceptance Criteria

- Toggle **on** (default): Stability/Roadmap scores, trend, and tickets identical to today.
- Toggle **off**: support tickets excluded from Stability & Roadmap numerator **and** denominator;
  Support score unchanged; selected week and trend both reflect the exclusion.
- `?includeSupport=false` round-trips through the URL (shareable, reload-safe).
- Included-tickets table has an All/per-board `BoardChip` filter; "All" shows all; filtering is
  client-side.
- With tz = Australia/Sydney and a late-Sunday local time, the defaulted week equals the backend's
  last-completed week.
- `get_healthcheck_report` exposes `includeSupport`, forwards only when set, has a test for both
  cases, and the MCP package version is bumped.

## Key Design Decisions

- **Exclude support from denominator + numerators** (not numerator-only) — "exclude support" means
  score planned-work quality on planned work, not penalise the score.
- **Flag applied to scores + trend + tickets uniformly** so no view disagrees; carried as a URL
  param for shareability.
- **Board filter is client-side** on the loaded list — no new endpoint, no re-fetch; matches the
  gaps/unplanned-done convention.
- **Backend week math untouched** — the bug is frontend-only; fix threads the already-available
  server timezone through the frontend helpers.

## Infrastructure Changes

None.

## Security Considerations

None identified. Read-only report; new query param is a bounded boolean validated by the DTO; no
new data exposure, no auth/secret/IAM/network surface touched.

## Alternatives Considered

- **Numerator-only exclusion** (keep support in D): rejected — penalises scores rather than
  isolating planned work; not the requested semantics.
- **Toggle affecting only the selected week, not the trend:** rejected — scores and trend would
  disagree and the trend line would be misleading.
- **New per-board healthcheck endpoint for the table filter:** rejected — YAGNI; the tickets are
  already loaded, client-side filtering is one `useMemo`.
