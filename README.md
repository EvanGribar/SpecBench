# SpecBench

SpecBench is a local-first benchmark for explicit product-requirement violations in AI code review. v0.3 is an evidence-focused experimental release: it compares a single reviewer, a controlled swarm without debate, and the same swarm with one debate round.

## v0.3 experiment

```bash
pnpm install
pnpm validate
pnpm experiment:v0.3:dry-run
# Explicit credentials are required for each live command:
pnpm experiment:v0.3:single-agent
pnpm experiment:v0.3:swarm-no-debate
pnpm experiment:v0.3:swarm-with-debate
pnpm experiment:v0.3:score
pnpm experiment:v0.3:report
```

Live runs require `OPENAI_API_KEY`; ordinary validation, tests, and CI never call a model. Raw artifacts are written beneath `results/v0.3/runs/` without overwriting existing files. See `docs/V0.3_EXPERIMENT_READINESS.md`, `docs/case-review/`, and `docs/V0.3_RESULTS.md`.

[![CI](https://github.com/EvanGribar/SpecBench/actions/workflows/ci.yml/badge.svg)](https://github.com/EvanGribar/SpecBench/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

SpecBench is a local-first benchmark for measuring whether AI coding and review systems identify violations of explicit product requirements in proposed code changes.

`v0.1.0-beta` is implemented: it is the early, three-case benchmark release with deterministic scoring, offline fixtures, a CLI, and static JSON/HTML reports. It is deliberately small and results from it must not be generalized.

`v0.2` is the first experimental release candidate. Its 10 distinct cases cover authorization, plan limits, validation, state transitions, product omissions, notifications, cancellations, regression safety, and UX requirements. It still is not a general measure of coding-agent quality, security coverage, code style, or production readiness.

- [Specification](SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [v0.2 initial-results report](docs/V0.2_INITIAL_RESULTS.md)

## Quick start

Requires Node.js 20+ and pnpm. From a fresh clone:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm specbench list
pnpm specbench run --reviewer json-file --input fixtures/perfect.json --output results/run.json
pnpm specbench report --results results/run.json
```

This is fully offline. CI uses the same fixture pathway and never makes a live model call. A live single-agent run requires explicit credentials and adapter configuration.

Example terminal output from the final command:

```text
Reviewer: json-file
Cases: 10
TP 10 | FP 0 | FN 0
Precision 100.0% | Recall 100.0% | F1 100.0%
Weighted recall 100.0% | Critical detection 100.0%
Runtime 420ms | Estimated cost $0.0000
Wrote results/report.json and results/report.html
```

The generated HTML begins with a static metric table and per-case evidence:

```html
<h1>SpecBench report</h1>
<tr><td>True positives</td><td>10</td></tr>
<h2>admin-invite-authorization — Member can create team invitations</h2>
```

## Scoring and cases

Matching is deterministic: requirement identifiers, then file/line overlap, then case-defined aliases. A submitted finding can satisfy only one expected finding; duplicates become false positives. Each v0.2 case records the explicit requirement, seeded violation, severity, source location, impact, acceptable descriptions, and a plausible non-issue.

Fixture outputs cover a perfect review, high recall with false positives, high precision with misses, duplicate findings, an incorrect severity, and total failure. Experiment configurations for the single-agent baseline and Swarm Review with and without debate are in [`experiments/v0.2`](experiments/v0.2). Published experiment results must retain raw output, normalized output, configuration metadata, cost, runtime, and benchmark version.

## Limitations

The current v0.2 suite has only 10 cases. It is an experimental controlled suite, not an industry standard; do not generalize results until real baseline runs have been completed and manually inspected. The static initial-results report intentionally makes no performance claims.

## License

Apache-2.0. See [LICENSE](LICENSE).
