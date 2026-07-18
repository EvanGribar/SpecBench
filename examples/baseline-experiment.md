# Baseline experiment template

Run each reviewer against the same version, cases, and budgets, then preserve
the resulting JSON artifacts. Swarm Review is deliberately integrated through
exported findings so SpecBench does not depend on its internals.

```bash
# Replace exported-swarm-debate.json with a Swarm Review export.
pnpm specbench run --reviewer swarm-review --input exported-swarm-debate.json --max-cases 8 --max-calls 8 --output results/swarm-debate.json
pnpm specbench run --reviewer swarm-review --input exported-swarm-single.json --max-cases 8 --max-calls 8 --output results/swarm-single.json

# Offline shape and report verification:
pnpm specbench run --reviewer json-file --fixture perfect --max-cases 8 --max-calls 8 --output results/single-agent-fixture.json
pnpm specbench report --results results/single-agent-fixture.json --html results/single-agent-fixture.html
```

Record model/version, debate configuration, case selection, token/call limits,
runtime, estimated cost, and the benchmark Git revision. Do not compare overall
F1 alone: inspect missed requirements, false positives, severity-weighted recall,
and critical issue detection.
