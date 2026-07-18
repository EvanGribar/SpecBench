import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BenchmarkCaseSchema, RunResultSchema } from "../packages/core/src/index.js";
import { describe as descriptiveStats, renderHtmlReport, scoreRun, summarizeExperiment, terminalSummary } from "../packages/reporter/src/index.js";
const root = process.cwd();
const readCase = (id: string) => BenchmarkCaseSchema.parse(JSON.parse(readFileSync(join(root, `benchmarks/v0.2/${id}/case.json`), "utf8")));
const cases = [readCase("admin-invite-authorization"), readCase("starter-seat-limit"), readCase("notification-cancellation")];
describe("reporting", () => {
  it("renders a safe, complete static report", () => { const fixture = JSON.parse(readFileSync(join(root, "fixtures/perfect.json"), "utf8")); const run = RunResultSchema.parse({ schemaVersion: "1", benchmarkVersion: "v0.2", reviewer: { name: "fixture" }, createdAt: "2026-01-01T00:00:00Z", cases: cases.map((benchmarkCase) => ({ caseId: benchmarkCase.id, raw: fixture.cases[benchmarkCase.id], output: fixture.cases[benchmarkCase.id] })) }); const scored = scoreRun(run, cases); expect(terminalSummary(scored)).toContain("TP 3"); expect(renderHtmlReport(scored)).toContain("SpecBench report"); });
});
describe("v0.3 aggregation", () => {
  it("calculates stable descriptive statistics", () => { expect(descriptiveStats([]).mean).toBeNull(); expect(descriptiveStats([1, 3, 5])).toMatchObject({ mean: 3, median: 3, min: 1, max: 5 }); });
  it("preserves repetition and case-level results", () => { const fixture = JSON.parse(readFileSync(join(root, "fixtures/perfect.json"), "utf8")); const run = RunResultSchema.parse({ schemaVersion: "1", benchmarkVersion: "v0.2", reviewer: { name: "fixture" }, createdAt: "2026-01-01T00:00:00Z", configuration: { id: "fixture" }, cases: cases.map((benchmarkCase) => ({ caseId: benchmarkCase.id, raw: fixture.cases[benchmarkCase.id], output: fixture.cases[benchmarkCase.id] })) }); const summary = summarizeExperiment([{ ...scoreRun(run, cases), run: { ...run, repetition: 1 } }]); expect(summary[0].repetitions).toBe(1); expect(summary[0].perCase).toHaveLength(3); expect(summary[0].automatic.costPerTruePositive.mean).toBe(0); });
});
