# Contributing to SpecBench

Thanks for helping improve a small, transparent benchmark. Please open a focused issue before large changes and keep pull requests limited to one concern.

## Prerequisites and workflow

- Node.js 20 or newer
- pnpm 10.32.1 (the repository pins this through `packageManager`)
- Git

From a fresh checkout:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm validate
pnpm test
pnpm build:reference
pnpm experiment:v0.3:dry-run
pnpm experiment:v0.3:smoke-budget-audit
```

The commands above are offline. Live provider runs are optional, use your own credentials, and must never be added to CI.

## Repository structure

- `benchmarks/` — immutable case definitions and patches by benchmark version
- `fixtures/` — offline reviewer outputs and failure profiles
- `packages/` — core schema/scoring, adapters, CLI, and reporting
- `apps/reference-saas/` — compact reference application
- `experiments/` — explicit v0.3 configuration files
- `results/` — reviewed result artifacts and reports
- `docs/` — methodology, release notes, run acceptance, and roadmap
- `tests/` — unit and integration coverage

## How benchmark cases work

Each case pairs an explicit product requirement with a baseline application state and a patch containing a seeded violation. The case also defines the expected finding, severity, source location, acceptable matching aliases, and distractors that should not be reported. Cases must test a meaningful requirement, not framework trivia.

### Adding a case

1. Add a new immutable directory under a versioned `benchmarks/<version>/` path.
2. Include `case.json` and the referenced patch.
3. Keep identifiers, locations, severity, and matching rules stable.
4. Add fixtures or tests that demonstrate both detection and plausible non-issues.
5. Run `pnpm validate`, `pnpm test`, and `pnpm typecheck`.

### Adding an adapter

Implement `ReviewerAdapter` in `packages/adapters/src`. Preserve raw output, return normalized findings, expose cost/runtime when available, and make network calls explicit and opt-in. Adapter changes must include tests using fixtures; CI must remain offline.

### Submitting a contributed run

Follow [docs/CONTRIBUTED_RUNS.md](docs/CONTRIBUTED_RUNS.md). Keep raw artifacts, exact model/configuration metadata, normalized findings, scoring output, usage, cost, runtime, retries, and environment metadata together. Remove secrets before submission.

## Research integrity

Contributors must:

- preserve raw outputs and avoid manually editing findings;
- record exact model identifiers, provider, configuration, and benchmark version;
- disclose prompt, adapter, matching, or benchmark changes;
- separate automatic metrics from human-adjudicated metrics; and
- avoid broad claims from small samples or a single smoke run.

Maintainers may reject results or cases with missing raw artifacts, vague model identity, undisclosed changes, selective reporting, secrets, or claims that exceed the evidence.

## Commits and pull requests

Use a clear imperative commit subject. Keep the PR focused, explain methodological impact, include validation commands, and attach screenshots or artifacts when documentation or reports change. Maintainers may request a case review or an independent adjudication before accepting benchmark-affecting changes.

## Maintainer rejection criteria

Changes may be rejected when they add unbounded live spend, alter published results without provenance, weaken deterministic scoring, include secrets or personal data, make unsupported superiority claims, add hosted-service assumptions, or broaden scope beyond the stated PR.

## Versioning policy

Benchmark releases are immutable directories under `benchmarks/<version>`. A breaking case/result schema change creates a new schema version. Corrections to published ground truth receive a documented patch release and changelog entry.
