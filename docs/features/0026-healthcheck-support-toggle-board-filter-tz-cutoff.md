# 0026 — Healthcheck: support-inclusion toggle, tickets board filter, timezone week cutoff

**Date:** 2026-08-21
**Status:** Implemented
**Source:** Manual
**Related proposal:** docs/proposals/0085-healthcheck-support-toggle-board-filter-tz-cutoff.md

## Summary

Three related changes to the weekly Healthcheck page: (1) a toggle — on by default — to
include or exclude support tickets from the Stability and Roadmap scores; (2) an All/per-board
filter at the top of the included-tickets table; and (3) a bug fix so the "latest / last
completed week" cutoff is computed in the configured timezone rather than UTC.

## Background / Motivation

- **Support toggle:** Stability and Roadmap currently score against a denominator that includes
  reactive support tickets. Support work is unplanned and unlinked by nature, so on
  support-heavy weeks it drags both scores down and obscures how well *planned* work was
  planned/roadmapped. Teams want to optionally strip support out to see planned-work quality in
  isolation. Default stays on (no change) so existing dashboards and links are unaffected.
- **Board filter:** The included-tickets table pools every board's tickets with no way to focus
  on one. Every other multi-board table in the app (gaps, unplanned-done) already has an
  All/per-board chip filter; the Healthcheck table should match.
- **TZ bug:** The frontend computes the default/"latest" week using `new Date()` interpreted in
  UTC. The backend already computes week boundaries in the configured timezone. Near a week
  boundary (e.g. Sunday night in Australia/Sydney, UTC+10/+11) the frontend and backend disagree
  on which week is "last completed", so the page can default to the wrong week.

## Scope

**In scope**
- `includeSupport` query param (default `true`) on `GET /api/healthcheck`, applied to the
  selected-week scores, the 8-week trend, and the tickets list.
- Excluding support tickets from the Stability & Roadmap **denominator and numerators** when the
  toggle is off (Support score unaffected).
- A UI toggle on the Healthcheck page, URL-param driven (shareable), default on.
- Matching `includeSupport` param on the `get_healthcheck_report` MCP tool + test + version bump.
- Client-side All/per-board `BoardChip` filter on the included-tickets table.
- Frontend fix: compute current / last-completed week in the configured timezone via
  `getAppConfig().timezone`.

**Out of scope**
- Any change to backend week-boundary math (already timezone-correct).
- Auditing other pages for the same UTC pattern (Healthcheck is the reported surface).
- Persisting the toggle server-side or per-user.

## Acceptance Criteria

- Given the toggle is **on** (default), when the Healthcheck loads, then the Stability and
  Roadmap scores, trend, and tickets are identical to current behaviour.
- Given the toggle is **off**, when scores are computed, then support tickets are excluded from
  both the numerator and denominator of Stability and Roadmap; the Support score is unchanged.
- Given the toggle is off, then the 8-week trend and the selected-week scores both reflect the
  exclusion (they never disagree).
- Given `includeSupport=false` is in the URL, when the page is shared/reloaded, then the toggle
  restores to off.
- Given the included-tickets table, when a board chip is selected, then only that board's tickets
  show; "All" shows every board; filtering is client-side on the already-loaded list.
- Given a configured timezone of Australia/Sydney and a local time late Sunday, when the page
  opens with no `week` param, then the defaulted week matches the backend's last-completed week
  (no off-by-one).
- The `get_healthcheck_report` MCP tool exposes `includeSupport`, forwards it only when set, and
  has a test asserting the forwarding; `apps/mcp/package.json` version is bumped.

## Open Questions

None.

## Notes

- Toggle semantics confirmed: exclude support from denominator **and** numerators (score =
  planned-non-support / started-non-support). Support score never changes.
- The tickets list already carries a `support` flag per ticket, so the frontend filter and the
  backend exclusion use the same classification.
