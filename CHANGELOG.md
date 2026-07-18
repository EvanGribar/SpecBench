# Changelog

## 0.3.1-beta — Live smoke-test validation — 2026-07-18

- Added preserved successful OpenAI-backed smoke artifacts for the single-agent, no-debate swarm, and one-round debate swarm configurations.
- Added a durable local smoke-budget ledger shared across CLI processes, with atomic writes, exclusive locking, conservative ambiguous-usage handling, and offline status/audit commands.
- Added ledger persistence, settlement, failure, locking, reconciliation, migration, and ceiling-enforcement coverage.
- This patch validates the live experiment pipeline end to end; the one-case, one-repetition smoke test is not benchmark-comparison evidence. Issue #15 remains open for any separately authorized larger experiment.

## 0.3.0-beta — Preliminary experimental release — 2026-07-18

- Added controlled v0.3 single-agent, no-debate swarm, and debate swarm configurations.
- Added explicit dry-run, unique run artifacts, failure preservation, repetition scoring, and preliminary report exports.
- Added readiness and external case-review documentation; results remain preliminary until live runs and adjudication are complete. Live execution is tracked separately in issue #15.

## 0.2.0 — Experimental — 2026-07-18

- Added a 10-case v0.2 suite with explicit requirement, violation, impact, matching, and distractor metadata.
- Added deterministic duplicate-protection coverage, result fixtures, offline experiment configurations, and a static initial-results report.
- Added version-aware CLI commands and retained fixture-only CI.

## 0.1.0-beta — 2026-07-18

- Released the implemented early three-case local-first benchmark.
- Included deterministic scoring, offline fixture reviewers, CLI validation/list/run/score/report commands, and static JSON/HTML reporting.
- This beta is intentionally too small for generalized conclusions.
