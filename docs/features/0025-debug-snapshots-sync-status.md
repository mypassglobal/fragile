# 0025 — Debug screen: snapshots and sync status

**Date:** 2026-08-13
**Status:** Implemented
**Source:** Manual
**Related proposal:** _(none — frontend-only, see Notes)_

## Summary

Expand the `/debug` screen (feature 0020) to add two read-only sections below the existing
per-ticket inspector: **Snapshots** (per-board DORA snapshot status) and **Sync status**
(per-board last sync). Both surface operational state already exposed by existing backend
endpoints.

## Background / Motivation

The debug screen currently only inspects a single Jira ticket's mirrored data. When
diagnosing stale metrics or a failed sync, an operator has no in-app view of snapshot
freshness or per-board sync outcomes and must query the DB directly. Both signals are
already served by existing endpoints — surfacing them on the debug page closes the gap
with no backend work.

## Scope

**In scope**
- A "Snapshots" section listing per-board DORA snapshot status: boardId, computedAt,
  staleness, whether aggregate/trend snapshots exist. Metadata only — no payload dump.
- A "Sync status" section listing per-board last sync: boardId, lastSync, status, syncType.
- A typed `api.ts` wrapper for `GET /api/metrics/dora/snapshot/status`.
- Independent load + error handling per section.

**Out of scope**
- Any backend, schema, or infrastructure change.
- Snapshot payload inspection / raw JSON dump.
- Full SyncLog run history (only latest-per-board, via the existing endpoint).
- MCP tool changes (no backend endpoint is added or altered).

## Acceptance Criteria

- Given the debug page loads, when snapshot status resolves, then a Snapshots section lists
  each board's boardId, computedAt, staleness, and aggregate/trend presence — no payload.
- Given the debug page loads, when sync status resolves, then a Sync status section lists
  each board's boardId, lastSync, status, and syncType.
- Given one section's request fails, then the other section and the ticket inspector still
  render (independent error handling).
- Given a section is loading or empty, then a loading / empty state is shown.
- No backend, schema, or infra files change; no MCP tool changes.

## Open Questions

None.

## Notes

Both data sources already exist server-side:
- Sync status: `GET /api/sync/status` — `getSyncStatus()` wrapper already in `lib/api.ts`.
- Snapshot status: `GET /api/metrics/dora/snapshot/status` → `BoardSnapshotStatus[]`
  (`metrics.controller.ts:164`) — needs a new typed `api.ts` wrapper.

Frontend-only change: one new typed wrapper plus two rendered sections. No module boundary,
schema, Jira integration, infra, or security-posture change — below the proposal threshold.
