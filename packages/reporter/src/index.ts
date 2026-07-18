import { writeFileSync } from "node:fs";
import type { BenchmarkCase, RunResult } from "../../core/src/index.js";
import { aggregateScores, matchCase, type AggregateMetrics, type CaseScore } from "../../scorer/src/index.js";

export type ScoredRun = { schemaVersion: "1"; run: RunResult; metrics: AggregateMetrics; cases: Array<{ benchmarkCase: BenchmarkCase; score: CaseScore; findings: RunResult["cases"][number]["output"]["findings"] }> };
export function scoreRun(run: RunResult, benchmarkCases: BenchmarkCase[]): ScoredRun {
  const cases = run.cases.map((result) => { const benchmarkCase = benchmarkCases.find((item) => item.id === result.caseId); if (!benchmarkCase) throw new Error(`Result references unknown case: ${result.caseId}`); const score = matchCase(benchmarkCase, result.output.findings); return { benchmarkCase, score, findings: result.output.findings }; });
  return { schemaVersion: "1", run, cases, metrics: aggregateScores(cases.map((item, index) => ({ benchmarkCase: item.benchmarkCase, score: item.score, runtimeMs: run.cases[index].output.runtimeMs, estimatedCostUsd: run.cases[index].output.estimatedCostUsd }))) };
}
export function terminalSummary(scored: ScoredRun): string {
  const m = scored.metrics; const pct = (value: number | null) => value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
  return [`Reviewer: ${scored.run.reviewer.name}${scored.run.reviewer.version ? ` (${scored.run.reviewer.version})` : ""}`, `Cases: ${scored.cases.length}`, `TP ${m.truePositives} | FP ${m.falsePositives} | FN ${m.falseNegatives}`, `Precision ${pct(m.precision)} | Recall ${pct(m.recall)} | F1 ${pct(m.f1)}`, `Weighted recall ${pct(m.severityWeightedRecall)} | Critical detection ${pct(m.criticalIssueDetectionRate)}`, `Runtime ${m.runtimeMs}ms | Estimated cost $${m.estimatedCostUsd.toFixed(4)}`].join("\n");
}
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
export function renderHtmlReport(scored: ScoredRun): string {
  const m = scored.metrics; const items = scored.cases.map(({ benchmarkCase, score, findings }) => `<section><h2>${escapeHtml(benchmarkCase.id)} — ${escapeHtml(benchmarkCase.title)}</h2><p><strong>Requirement:</strong> ${escapeHtml(benchmarkCase.requirement)}</p><p>Detected: ${score.matches.length}; missed: ${score.missedFindingIds.join(", ") || "none"}; false positives: ${score.falsePositiveIndexes.length}</p><h3>Expected findings</h3><ul>${benchmarkCase.expectedFindings.map((finding) => `<li><strong>${escapeHtml(finding.id)}</strong> (${finding.severity}) ${escapeHtml(finding.title)} — ${escapeHtml(finding.file)}:${finding.startLine ?? "?"}</li>`).join("")}</ul><h3>Submitted findings</h3><ul>${findings.map((finding) => `<li>${escapeHtml(finding.title)} (${escapeHtml(finding.severity ?? "unspecified")}) — ${escapeHtml(finding.file ?? "no file")}</li>`).join("") || "<li>None</li>"}</ul></section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SpecBench report</title><style>body{font:16px system-ui;max-width:960px;margin:2rem auto;padding:0 1rem;color:#172033}section{border-top:1px solid #d8dee9;padding:1rem 0}table{border-collapse:collapse}td,th{padding:.4rem .7rem;border:1px solid #d8dee9;text-align:left}code{background:#f3f5f7;padding:.1rem .25rem}</style></head><body><h1>SpecBench report</h1><p>Benchmark ${escapeHtml(scored.run.benchmarkVersion)} · ${escapeHtml(scored.run.createdAt)} · Reviewer: ${escapeHtml(scored.run.reviewer.name)}</p><table><tr><th>Metric</th><th>Value</th></tr><tr><td>True positives</td><td>${m.truePositives}</td></tr><tr><td>False positives</td><td>${m.falsePositives}</td></tr><tr><td>False negatives</td><td>${m.falseNegatives}</td></tr><tr><td>Precision</td><td>${m.precision ?? "n/a"}</td></tr><tr><td>Recall</td><td>${m.recall ?? "n/a"}</td></tr><tr><td>F1</td><td>${m.f1 ?? "n/a"}</td></tr><tr><td>Severity-weighted recall</td><td>${m.severityWeightedRecall ?? "n/a"}</td></tr><tr><td>Critical detection rate</td><td>${m.criticalIssueDetectionRate ?? "n/a"}</td></tr><tr><td>Runtime / cost</td><td>${m.runtimeMs}ms / $${m.estimatedCostUsd.toFixed(4)}</td></tr></table>${items}<section><h2>Known limitations</h2><p>SpecBench measures a controlled set of explicit product requirements. Deterministic matching can miss differently worded valid findings and does not measure general code quality or security coverage.</p></section></body></html>`;
}
export function writeReports(scored: ScoredRun, jsonPath: string, htmlPath: string): void { writeFileSync(jsonPath, `${JSON.stringify(scored, null, 2)}\n`); writeFileSync(htmlPath, renderHtmlReport(scored)); }

export type DescriptiveStats = { mean: number | null; median: number | null; min: number | null; max: number | null; standardDeviation: number | null };
export type ExperimentSummary = { configurationId: string; repetitions: number; automatic: Record<string, DescriptiveStats>; perCase: Array<{ caseId: string; repetition: number; truePositives: number; falsePositives: number; falseNegatives: number; runtimeMs: number; estimatedCostUsd: number }> };
export function describe(values: number[]): DescriptiveStats {
  if (!values.length) return { mean: null, median: null, min: null, max: null, standardDeviation: null };
  const sorted = [...values].sort((a, b) => a - b); const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, median: sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2, min: sorted[0], max: sorted.at(-1)!, standardDeviation: values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) : 0 };
}
export function summarizeExperiment(runs: ScoredRun[]): ExperimentSummary[] {
  const groups = new Map<string, ScoredRun[]>(); for (const run of runs) { const id = String(run.run.configuration.id ?? run.run.reviewer.name); groups.set(id, [...(groups.get(id) ?? []), run]); }
  return [...groups.entries()].map(([configurationId, group]) => {
    const metrics = ["truePositives", "falsePositives", "falseNegatives", "precision", "recall", "f1", "severityWeightedRecall", "criticalIssueDetectionRate", "averageFindingsPerCase", "runtimeMs", "estimatedCostUsd"];
    const automatic = Object.fromEntries(metrics.map((metric) => [metric, describe(group.map((run) => Number((run.metrics as any)[metric])).filter(Number.isFinite))]));
    Object.assign(automatic, {
      casesWithAllExpectedFindings: describe(group.map((run) => run.cases.filter((item) => !item.score.missedFindingIds.length).length)),
      casesWithZeroValidFindings: describe(group.map((run) => run.cases.filter((item) => !item.score.matches.length).length)),
      costPerCase: describe(group.map((run) => run.cases.length ? run.metrics.estimatedCostUsd / run.cases.length : 0)),
      costPerTruePositive: describe(group.map((run) => run.metrics.truePositives ? run.metrics.estimatedCostUsd / run.metrics.truePositives : 0)),
      runtimePerCase: describe(group.map((run) => run.cases.length ? run.metrics.runtimeMs / run.cases.length : 0))
    });
    return { configurationId, repetitions: group.length, automatic, perCase: group.flatMap((run) => run.cases.map((item, index) => ({ caseId: item.benchmarkCase.id, repetition: Number((run.run as any).repetition ?? 1), truePositives: item.score.matches.length, falsePositives: item.score.falsePositiveIndexes.length, falseNegatives: item.score.missedFindingIds.length, runtimeMs: run.run.cases[index].output.runtimeMs ?? 0, estimatedCostUsd: run.run.cases[index].output.estimatedCostUsd ?? 0 }))) };
  });
}
