# Contributing to SpecBench

Thanks for helping improve a small, transparent benchmark. Please open a focused
issue before large changes and keep pull requests limited to one concern.

## Development workflow

1. Install dependencies with `pnpm install`.
2. Make the smallest coherent change.
3. Run `pnpm typecheck`, `pnpm validate`, and `pnpm test`.
4. Include fixtures and tests for new matching, adapter, or case behavior.

## Adding a benchmark case

Each case needs a stable id, explicit requirement, baseline revision, patch,
ground-truth finding locations, severity, rationale, aliases, and optional
distractors. Cases should measure understandable product requirements, not
obscure framework behavior. Do not include API keys, personal data, or live
service dependencies. See `benchmarks/v0.1/` for examples.

## Adding an adapter

Implement `ReviewerAdapter` in `packages/adapters/src`. Preserve raw output,
return normalized findings, expose cost/runtime when available, and make live
network calls opt-in. Automated tests and CI must use fixtures only.

## Versioning policy

Benchmark releases are immutable directories under `benchmarks/<version>`. A
breaking case/result schema change creates a new schema version. Corrections to
published ground truth receive a documented patch release and changelog entry.
