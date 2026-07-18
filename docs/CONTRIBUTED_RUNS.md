# Contributed runs

Outside model runs are useful only when another developer can reproduce what happened. Submit a focused issue using the **Contributed benchmark run** template before opening a PR with artifacts.

## Acceptance format

Every submission must include:

- immutable benchmark version;
- exact repository commit SHA;
- provider and exact model identifier;
- configuration file and any prompt or adapter changes;
- raw response artifacts, normalized findings, and scoring output;
- token usage, cost, runtime, retry, and failure data;
- relevant environment metadata without secrets; and
- confirmation that outputs were not manually edited and secrets were removed.

Keep automatic metrics separate from human-adjudicated metrics. Preserve the original raw output even when normalization or matching fails.

Results may be rejected when raw artifacts are missing, the benchmark was modified without disclosure, model identity is vague, outputs were manually rewritten, only favorable runs were submitted, secrets are present, or claims exceed the evidence.

## Machine-readable manifest

Use a manifest like this next to the artifacts. Replace placeholders; do not commit credentials.

```json
{
  "schemaVersion": "1",
  "benchmarkVersion": "v0.2",
  "commitSha": "0123456789abcdef0123456789abcdef01234567",
  "provider": "example-provider",
  "model": "provider/model-version",
  "configuration": "experiments/v0.3/single-agent.json",
  "promptChanges": "none",
  "adapterChanges": "none",
  "repetitions": 3,
  "rawArtifacts": ["raw/run-001.json"],
  "normalizedFindings": "normalized/findings.json",
  "scoringOutput": "scoring/summary.json",
  "tokenUsage": {"input": 0, "output": 0, "total": 0},
  "costUsd": 0.0,
  "runtimeMs": 0,
  "retries": 0,
  "failures": [],
  "environment": {"node": "20.x", "pnpm": "10.32.1", "os": "linux"},
  "outputsManuallyEdited": false,
  "secretsRemoved": true
}
```
