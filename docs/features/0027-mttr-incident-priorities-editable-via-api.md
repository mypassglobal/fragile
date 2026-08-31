# 0027 — MTTR incident priorities editable via board config API

**Date:** 2026-08-31
**Status:** In Progress
**Source:** Manual
**Related proposal:** None (trivial DTO gap-fix — no schema, module, infra, or security change)

## Summary

Expose the existing per-board `incidentPriorities` field on the board config update API
(`PUT /api/boards/:boardId/config`) so the MTTR incident-priority filter can be edited at
runtime, not only via build-time YAML config. Default remains `["Critical"]`.

## Background / Motivation

MTTR incident matching is already per-board via `BoardConfig.incidentPriorities` — the column
exists (migration `1775820876077-AddPriorityAndIncidentPriorities`, `NOT NULL DEFAULT
'["Critical"]'`), is read by every metric service (`mttr.service.ts`, `sprint-detail`,
`quarter-detail`, `week-detail`), and is settable via YAML (`boards-yaml.schema.ts`).

However `incidentPriorities` was omitted from `UpdateBoardConfigDto` while every sibling
incident field (`incidentIssueTypes`, `recoveryStatusNames`, `incidentLabels`) is present.
Because the global `ValidationPipe` runs with `whitelist: true`, any `incidentPriorities`
sent to the update endpoint is silently stripped — the field can never be changed via the
API. This closes that gap.

## Scope

**In scope**
- Add `incidentPriorities` to `UpdateBoardConfigDto` (validated string array, Swagger-documented).
- Add `incidentPriorities` to the frontend `BoardConfig` type and an editable "Incident
  Priorities" field in the MTTR Detection card on the settings page.

**Out of scope**
- Schema/migration (column already exists).
- Metric calculation logic (already consumes the field with `["Critical"]` default and
  `[]` = all-priorities semantics).
- MCP tools — the boards MCP tools are read-only (`list_boards`, `get_board_config`); the
  read tool returns the full config entity, so the field already surfaces. No update tool
  exists, so no tool input schema drifts and no version bump is required.

## Acceptance Criteria

- Given a `PUT /api/boards/:boardId/config` body containing `incidentPriorities: ["High"]`,
  when validated by the global whitelisting `ValidationPipe`, then `incidentPriorities`
  survives (is not stripped) and persists to `BoardConfig`.
- Given `incidentPriorities` was never set, when MTTR computes, then it defaults to
  `["Critical"]` (unchanged existing behaviour).
- Given `incidentPriorities: []`, when MTTR computes, then all priorities qualify (unchanged
  AND-gate semantics).
- Given a non-string-array value for `incidentPriorities`, when validated, then the request
  is rejected.

## Open Questions

None.

## Notes

The MTTR default (`["Critical"]`) lives in three places and is unchanged: the DB column
default, and the `?? ['Critical']` fallback in each metric service. This change only makes
the field reachable through the update DTO.
