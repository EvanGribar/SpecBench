# SpecBench v0.1 Specification

## Purpose

SpecBench evaluates a narrow question: can an AI code-review system recognize
when a technically plausible pull request violates an explicit business or
product requirement? The benchmark emphasizes requirement comprehension rather
than framework trivia or exploit research.

## v0.1 deliverable

The first usable release contains a TypeScript/Node.js command-line benchmark
with a compact reference SaaS application, a versioned case format validated by
Zod, deterministic scoring, JSON and static HTML reports, fixtures, tests, and
eight complete benchmark cases across the categories below.

The reference application may use Next.js, but the benchmark runner, scorer,
reporter, and adapters must run locally without a hosted backend. Authentication
and persistence are deliberately simplified and must be visibly documented as
test fixtures rather than production security patterns.

## In scope

- Explicit product requirements paired with baseline revisions and patches.
- Seeded findings with severity, source location, rationale, and match aliases.
- Authorization, plan limits, validation, state transitions, notifications,
  cancellation/retry behavior, omissions, regressions, edge cases, and
  misleading UX cases.
- Three v0.1 adapters: generic JSON results, a BYO-key single-agent LLM
  reviewer, and an adapter for exported Swarm Review results.
- Deterministic default matching, with optional manual mappings and an optional
  LLM-assisted matcher that never replaces the default.
- Cost controls: case/call/token/cost limits, dry run, fixture mode, and
  environment-only credentials.

## Out of scope

- Hosted dashboards, accounts, billing, teams, databases, or public result
  submission.
- Mandatory cloud infrastructure, provider accounts, or paid model calls.
- Automatic live evaluations in tests or CI.
- Claims that the benchmark is universal, comprehensive, or an industry
  standard.

## Benchmark contract

A benchmark release is a versioned directory under `benchmarks/<version>/`.
Each case has a validated definition, a baseline repository reference, a patch,
and optional fixture outputs. A case definition must provide:

1. Stable case id, title, description, and requirement text.
2. Repository base revision and patch path.
3. One or more expected findings with stable ids, severity, file/line location,
   requirement reference, explanation, and acceptable matching aliases.
4. Optional documented distractors that must not count as expected findings.

Definitions use JSON in v0.1 to avoid a second parsing dependency. The schema
is versioned (`schemaVersion: "1"`) and validated with Zod.

## Review and result contract

Adapters receive a case, its requirement, and a materialized baseline-plus-patch
review input. They return normalized findings with title, description, optional
severity, source location, confidence, runtime, estimated cost, and configuration
metadata. Raw adapter output is retained alongside normalized output.

Each invocation produces an immutable JSON result file. Result filenames include
benchmark version, reviewer name, UTC timestamp, and a run id. Reports consume
that result file; they never make network calls.

## Deterministic scoring contract

An expected finding is matched to at most one submitted finding, and a submitted
finding to at most one expected finding. Matching proceeds in this order:

1. Explicit manual mapping, when present.
2. Exact requirement/finding identifiers supplied by an adapter.
3. File match plus overlapping line range.
4. File match plus case-defined normalized keyword/alias overlap.

Unmatched expected findings are false negatives; unmatched submitted findings
are false positives. Duplicate reports of an already-matched issue remain false
positives. Severity disagreement is reported separately and does not erase an
otherwise valid match.

Reports expose true positives, false positives, false negatives, precision,
recall, F1, severity-weighted recall, critical-issue detection rate, average
findings per case, and supplied runtime/cost. Severity weights are critical 4,
high 3, medium 2, low 1. A zero-denominator metric is represented as `null`,
not silently converted to success.

## CLI contract

The discoverable `specbench` CLI will provide `validate`, `list`, `run`,
`score`, and `report` commands. `run` requires an explicit reviewer and defaults
to no live model calls; fixture and dry-run modes are supported. Every command
returns a nonzero exit code for invalid input and emits actionable diagnostics.

## Quality and reproducibility

TypeScript is used throughout. The repository targets Node.js 20+, pnpm,
Vitest, and Zod. Tests cover schemas, normalization, matching, metrics, invalid
references, empty and duplicate results, report generation, and CLI behavior.
CI validates and tests fixtures only. Published experiments record benchmark
version, commit references, adapter configuration, environment-independent
settings, runtime, cost estimates, and known limitations.

## v0.1 acceptance criteria

The detailed, testable acceptance criteria and ordered work items live in
`docs/V0.1_ISSUE_PLAN.md`. A release is v0.1-ready only when each required item
there is complete and the three seed cases can be validated, scored, and reported
from a clean checkout using fixture mode.
