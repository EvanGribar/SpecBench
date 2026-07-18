import { describe, expect, it } from "vitest";
import { BenchmarkCaseSchema, NormalizedFindingSchema, validateCase } from "../packages/core/src/index.js";
import { aggregateScores, matchCase } from "../packages/scorer/src/index.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const admin = BenchmarkCaseSchema.parse(JSON.parse(readFileSync(join(root, "benchmarks/v0.1/admin-invite-authorization/case.json"), "utf8")));

describe("case schema and validation", () => {
  it("accepts a complete case", () => expect(admin.id).toBe("admin-invite-authorization"));
  it("rejects duplicate expected findings", () => expect(() => BenchmarkCaseSchema.parse({ ...admin, expectedFindings: [admin.expectedFindings[0], admin.expectedFindings[0]] })).toThrow(/duplicate/));
  it("rejects malformed normalized findings", () => expect(() => NormalizedFindingSchema.parse({ title: "Only a title" })).toThrow());
  it("rejects unsafe repository and source references", () => expect(validateCase(join(root, "benchmarks/v0.1"), { ...admin, repository: { ...admin.repository, patchPath: "../bad.diff" }, expectedFindings: [{ ...admin.expectedFindings[0], file: "../secret.ts" }] })).toHaveLength(2));
  it("rejects a finding whose file is absent from the patch", () => expect(validateCase(join(root, "benchmarks/v0.1"), { ...admin, expectedFindings: [{ ...admin.expectedFindings[0], file: "apps/missing.ts" }] })[0]).toMatch(/not changed/));
});

describe("matching and metrics", () => {
  const exact = { title: "Missing admin role check", description: "A regular member may invite", severity: "high", file: "apps/reference-saas/app/api/teams/[teamId]/invites/route.ts", startLine: 13, requirementReference: "REQ-AUTH-1" };
  it("matches identifiers deterministically", () => { const score = matchCase(admin, [exact]); expect(score.matches).toHaveLength(1); expect(score.matches[0].method).toBe("id"); });
  it("counts duplicate reports as false positives and severity mismatch separately", () => { const score = matchCase(admin, [{ ...exact, severity: "low" }, exact]); expect(score.matches).toHaveLength(1); expect(score.falsePositiveIndexes).toHaveLength(1); expect(score.matches[0].severityCorrect).toBe(false); });
  it("returns null ratios for empty results", () => { const metrics = aggregateScores([]); expect(metrics.precision).toBeNull(); expect(metrics.recall).toBeNull(); expect(metrics.averageFindingsPerCase).toBe(0); });
  it("calculates precision, recall, and weights", () => { const score = matchCase(admin, [exact, { title: "Noise", description: "not expected", file: "other.ts" }]); const metrics = aggregateScores([{ benchmarkCase: admin, score }]); expect(metrics.precision).toBe(0.5); expect(metrics.recall).toBe(1); expect(metrics.severityWeightedRecall).toBe(1); });
});
