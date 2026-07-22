import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SpecBridgeAdapter, SwarmReviewAdapter } from "../packages/adapters/src/index.js";
import { BenchmarkCaseSchema } from "../packages/core/src/index.js";

const root = process.cwd();
const admin = BenchmarkCaseSchema.parse(JSON.parse(readFileSync(join(root, "benchmarks/v0.2/admin-invite-authorization/case.json"), "utf8")));

describe("Swarm Review adapter and experiment configurations", () => {
  it("normalizes an imported Swarm Review export without making a model call", async () => {
    const adapter = new SwarmReviewAdapter(join(root, "fixtures/swarm-review-export.json"));
    const output = await adapter.review({ benchmarkVersion: "v0.2", case: admin, patch: "", dryRun: true });
    expect(output.findings).toEqual([expect.objectContaining({ title: "Missing administrator role", file: "apps/reference-saas/app/api/teams/[teamId]/invites/route.ts", startLine: 12 })]);
    expect(output.metadata).toMatchObject({ caseId: admin.id });
  });

  it("ingests the provenance-pinned SpecBridge coverage fixture deterministically", async () => {
    const path = join(root, "fixtures/specbridge/swarm-review-v1.1.0/coverage.json");
    const first = await new SpecBridgeAdapter(path).review({ benchmarkVersion: "v0.2", case: admin, patch: "", dryRun: true });
    const second = await new SpecBridgeAdapter(path).review({ benchmarkVersion: "v0.2", case: admin, patch: "", dryRun: true });
    expect(first).toEqual(second);
    expect(first.criterionResults).toHaveLength(3);
    expect(first.criterionResults?.map((item) => item.status)).toEqual(["satisfied", "violated", "not_verifiable"]);
    expect(first.findings).toHaveLength(1);
    expect(first.raw).toBeTruthy();
  });

  it("defines all publishable v0.2 configurations with mandatory result provenance", () => {
    for (const name of ["single-agent-baseline", "swarm-review-no-debate", "swarm-review-debate"]) {
      const configuration = JSON.parse(readFileSync(join(root, `experiments/v0.2/${name}.json`), "utf8"));
      expect(configuration.benchmarkVersion).toBe("v0.2");
      expect(configuration.store).toEqual(expect.arrayContaining(["raw", "normalized", "configuration", "cost", "runtime", "benchmarkVersion"]));
    }
  });
});
