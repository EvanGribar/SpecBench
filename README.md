# SpecBench

SpecBench is an early, local-first benchmark for measuring whether AI coding and
review systems identify violations of explicit product requirements in proposed
code changes.

The project is in its planning phase. The v0.1 scope, architecture, acceptance
criteria, and implementation sequence are defined before benchmark cases or
reviewer integrations are built.

- [Project specification](SPEC.md)
- [Architecture proposal](ARCHITECTURE.md)
- [v0.1 issue plan and acceptance criteria](docs/V0.1_ISSUE_PLAN.md)

## What it will measure

Whether a reviewer identifies seeded product-requirement violations in
controlled pull-request-style patches, with transparent deterministic scoring.

## What it will not measure

SpecBench v0.1 will not be a general measure of coding-agent quality, security
coverage, code style, or production readiness. It will not include a hosted
service, accounts, billing, or a public submission platform.

## Quick start

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm validate
pnpm specbench list
pnpm specbench run --reviewer json-file --input fixtures/perfect.json --output results/run.json
pnpm specbench report --results results/run.json
```

This runs fully offline using a fixture. Reports are written to `results/` as
JSON and static HTML. Live model calls are never made by CI and require explicit
credentials and adapter configuration.

## Scoring

The default matcher is deterministic: explicit requirement ids, then file/line
overlap, then a case-defined alias match. Each expected and submitted finding can
match only once; duplicate submitted findings are false positives. The report
shows precision, recall, F1, severity-weighted recall, critical detection rate,
runtime, cost, and every missed or false-positive finding. See [SPEC.md](SPEC.md)
for the full matching contract.

## Extending the benchmark

To add a case, create `benchmarks/v0.1/<case-id>/case.json` and `patch.diff`,
then run `pnpm validate`. Definitions are versioned JSON and Zod-validated. To
add a reviewer, implement the small `ReviewerAdapter` interface in
`packages/adapters`; adapters return normalized findings and must not require a
hosted SpecBench service. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Reproducing results

Published result files should identify their benchmark version, reviewer,
configuration, timestamp, raw normalized findings, runtime, and estimated cost.
Run `specbench score` or `specbench report` against the result JSON to reproduce
the report without model access.

## Limitations

SpecBench is an early benchmark, not an industry standard or universal measure
of coding-agent quality. It measures controlled violations of explicit product
requirements; it does not establish security coverage, general code quality, or
production readiness. Deterministic matching may miss a valid but unusually
worded finding.

## Project documents

- [Specification](SPEC.md) and [architecture](ARCHITECTURE.md)
- [v0.1 issue plan](docs/V0.1_ISSUE_PLAN.md)
- [Roadmap](ROADMAP.md), [changelog](CHANGELOG.md), and [security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
