# Native SpecBridge coverage ingestion

SpecBench ingests `coverage.json` through the `specbridge` reviewer adapter. The artifact is authoritative; SARIF is optional supporting output and is never parsed as the source of coverage decisions.

The adapter validates with the actual pinned SpecBridge core (`7555472ea92d5876fa212376d43d40997ae1da81`), retains raw input and execution provenance, and preserves each criterion's requirement ID, status, explanation, confidence, and evidence locations.

`violated` is a candidate detected violation. `satisfied`, `not_verifiable`, and `not_applicable` remain explicit judgments: for a seeded expected violation they are respectively a contradiction, abstention, and applicability error. Existing finding-level scoring remains available.

Benchmark mappings may add `requirementId` and `criterionId` without changing old cases. The bundled Swarm-Review v1.1.0 artifact uses a mocked provider and validates ingestion behavior only; it does not measure model quality.
