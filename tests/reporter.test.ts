import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BenchmarkCaseSchema, RunResultSchema } from "../packages/core/src/index.js";
import { renderHtmlReport, scoreRun, terminalSummary } from "../packages/reporter/src/index.js";
const root = process.cwd();
const readCase = (id: string) => BenchmarkCaseSchema.parse(JSON.parse(readFileSync(join(root, `benchmarks/v0.2/${id}/case.json`), "utf8")));
const cases = [readCase("admin-invite-authorization"), readCase("starter-seat-limit"), readCase("notification-cancellation")];
describe("reporting", () => {
  it("renders a safe, complete static report", () => { const fixture = JSON.parse(readFileSync(join(root, "fixtures/perfect.json"), "utf8")); const run = RunResultSchema.parse({ schemaVersion: "1", benchmarkVersion: "v0.2", reviewer: { name: "fixture" }, createdAt: "2026-01-01T00:00:00Z", cases: cases.map((benchmarkCase) => ({ caseId: benchmarkCase.id, raw: fixture.cases[benchmarkCase.id], output: fixture.cases[benchmarkCase.id] })) }); const scored = scoreRun(run, cases); expect(terminalSummary(scored)).toContain("TP 3"); expect(renderHtmlReport(scored)).toContain("SpecBench report"); });
});
