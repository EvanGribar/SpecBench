# SpecBench v0.1 Architecture

## Design decisions

SpecBench uses a single pnpm workspace without Turborepo. The workload is small,
the packages have a simple dependency direction, and pnpm workspace scripts are
sufficient for local and CI builds. The command-line application is the product;
the optional Next.js reference SaaS app provides realistic source material only.

```
benchmarks/ + fixtures/ ──> core ──> adapters ──> scorer ──> reporter
                              │                         │
                              └──────────────────────> cli
apps/reference-saas ── baseline source and test target for benchmark patches
```

## Modules and ownership

| Area | Responsibility | Depends on |
| --- | --- | --- |
| `packages/core` | Zod schemas, typed domain models, case discovery, validation | Zod |
| `packages/adapters` | Reviewer interface; JSON, single-agent, and Swarm-export adapters | core |
| `packages/scorer` | Normalization, deterministic matching, metrics, scoring result schema | core |
| `packages/reporter` | Terminal summary, JSON serialization, standalone HTML renderer | core, scorer |
| `packages/cli` | Command parsing, limits, orchestration, safe filesystem I/O | all packages |
| `apps/reference-saas` | Small mocked SaaS source used by patches and tests | its app dependencies |
| `benchmarks/v0.1` | Versioned case definitions, patches, mappings | reference app layout |
| `fixtures` | Mock reviewer outputs and expected score snapshots | core result format |

Dependencies are one-way. Neither adapters nor the reference app may depend on
the CLI, scorer, or reporter. The scorer does not call models or read the network.

## Data flow

1. `validate` loads case definitions and verifies schema, patch paths, baseline
   references, expected finding locations, and duplicate ids.
2. `run` selects validated cases, materializes review input, enforces execution
   budgets, invokes one adapter per case, and writes raw plus normalized output.
3. `score` reads an immutable result file and applies deterministic matching.
4. `report` renders the same scored data to JSON, terminal text, and static HTML.

The initial implementation may materialize a patch as text plus referenced source
files. It must not mutate the user checkout. If temporary Git worktrees become
necessary, they are created outside the repository and cleaned safely.

## Stable file formats

Case definitions, run outputs, score outputs, and manual mapping files are JSON
with an explicit version field. Changes that break readers require a new versioned
schema. Existing benchmark releases and results are immutable once published.

## Adapter boundary

`ReviewerAdapter.review(input)` returns an adapter-neutral output. The JSON
adapter reads local files. The single-agent adapter is opt-in and uses provider
credentials only from environment variables; no credentials are logged or stored.
The Swarm adapter reads a documented exported-result format and has no compile-
time dependency on Swarm internals.

## Safety, cost, and CI

Live adapters require explicit user invocation. Before a live call, the CLI
checks maximum cases, calls, output tokens, and optionally estimated cost; dry
run lists planned calls without invoking them. Fixture mode is fully offline and
is the only mode used in CI. Reports escape untrusted finding text before placing
it in HTML.

## Reporting

The reporter emits a versioned JSON artifact and a self-contained static HTML
file. The HTML has no analytics, scripts from CDNs, or backend calls. It shows
aggregate metrics, per-case expected/detected/missed/false-positive findings,
runtime/cost/configuration metadata, and known limitations.

## Reference SaaS boundaries

The app models users, roles, teams, subscription plans, notifications, and an
in-memory data abstraction. Its test suite verifies intended behavior of each
baseline. Benchmark patches deliberately create reviewable requirement violations;
they do not need to be secure production code or require an external service.
