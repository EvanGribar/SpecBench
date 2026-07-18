# Fixture workflow

```bash
pnpm specbench run --reviewer json-file --input fixtures/perfect.json --output results/perfect-run.json
pnpm specbench score --results results/perfect-run.json
pnpm specbench report --results results/perfect-run.json
```

Use `fixtures/high-recall-fp.json`, `high-precision-missed.json`,
`total-failure.json`, and `duplicates-wrong-severity.json` to inspect common
reviewer failure profiles without a model key.
