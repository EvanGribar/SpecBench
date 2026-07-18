import type { BenchmarkCase, NormalizedFinding, Severity } from "../../core/src/index.js";

const weights: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
export type Match = { expectedId: string; findingIndex: number; method: "id" | "line" | "alias"; severityCorrect: boolean };
export type CaseScore = { caseId: string; matches: Match[]; falsePositiveIndexes: number[]; missedFindingIds: string[]; expectedCount: number; submittedCount: number; runtimeMs?: number; estimatedCostUsd?: number };
export type AggregateMetrics = { truePositives: number; falsePositives: number; falseNegatives: number; precision: number | null; recall: number | null; f1: number | null; severityWeightedRecall: number | null; criticalIssueDetectionRate: number | null; averageFindingsPerCase: number; runtimeMs: number; estimatedCostUsd: number; severityMismatches: number };

function words(value: string): Set<string> { return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2)); }
function overlap(a: Set<string>, b: Set<string>): boolean { return [...a].some((item) => b.has(item)); }
function sameFile(expected?: string, actual?: string): boolean { return Boolean(expected && actual && expected.replaceAll("\\", "/") === actual.replaceAll("\\", "/")); }
function rangesOverlap(aStart?: number, aEnd?: number, bStart?: number, bEnd?: number): boolean { if (!aStart || !bStart) return false; return aStart <= (bEnd ?? bStart) && bStart <= (aEnd ?? aStart); }

export function matchCase(benchmarkCase: BenchmarkCase, findings: NormalizedFinding[]): CaseScore {
  const used = new Set<number>(); const matches: Match[] = [];
  for (const expected of benchmarkCase.expectedFindings) {
    const manual = benchmarkCase.manualMappings.find((mapping) => mapping.expectedFindingId === expected.id);
    let index = manual ? findings.findIndex((finding, i) => !used.has(i) && finding.id === manual.findingId) : findings.findIndex((finding, i) => !used.has(i) && (finding.id === expected.id || finding.requirementReference === expected.requirementReference));
    let method: Match["method"] = "id";
    if (index < 0) { index = findings.findIndex((finding, i) => !used.has(i) && sameFile(expected.file, finding.file) && rangesOverlap(expected.startLine, expected.endLine, finding.startLine, finding.endLine)); method = "line"; }
    if (index < 0) { const aliases = words([expected.title, expected.description, ...expected.acceptableMatches].join(" ")); index = findings.findIndex((finding, i) => !used.has(i) && sameFile(expected.file, finding.file) && overlap(aliases, words(`${finding.title} ${finding.description}`))); method = "alias"; }
    if (index >= 0) { used.add(index); matches.push({ expectedId: expected.id, findingIndex: index, method, severityCorrect: findings[index].severity === expected.severity }); }
  }
  return { caseId: benchmarkCase.id, matches, falsePositiveIndexes: findings.map((_, i) => i).filter((i) => !used.has(i)), missedFindingIds: benchmarkCase.expectedFindings.map((item) => item.id).filter((id) => !matches.some((match) => match.expectedId === id)), expectedCount: benchmarkCase.expectedFindings.length, submittedCount: findings.length };
}

export function aggregateScores(cases: Array<{ benchmarkCase: BenchmarkCase; score: CaseScore; runtimeMs?: number; estimatedCostUsd?: number }>): AggregateMetrics {
  const truePositives = cases.reduce((sum, item) => sum + item.score.matches.length, 0); const falsePositives = cases.reduce((sum, item) => sum + item.score.falsePositiveIndexes.length, 0); const falseNegatives = cases.reduce((sum, item) => sum + item.score.missedFindingIds.length, 0); const expected = cases.flatMap((item) => item.benchmarkCase.expectedFindings); const matchedIds = new Set(cases.flatMap((item) => item.score.matches.map((match) => match.expectedId)));
  const weightedTotal = expected.reduce((sum, item) => sum + weights[item.severity], 0); const weightedDetected = expected.filter((item) => matchedIds.has(item.id)).reduce((sum, item) => sum + weights[item.severity], 0); const critical = expected.filter((item) => item.severity === "critical");
  const precision = truePositives + falsePositives ? truePositives / (truePositives + falsePositives) : null; const recall = truePositives + falseNegatives ? truePositives / (truePositives + falseNegatives) : null;
  return { truePositives, falsePositives, falseNegatives, precision, recall, f1: precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null, severityWeightedRecall: weightedTotal ? weightedDetected / weightedTotal : null, criticalIssueDetectionRate: critical.length ? critical.filter((item) => matchedIds.has(item.id)).length / critical.length : null, averageFindingsPerCase: cases.length ? cases.reduce((sum, item) => sum + item.score.submittedCount, 0) / cases.length : 0, runtimeMs: cases.reduce((sum, item) => sum + (item.runtimeMs ?? 0), 0), estimatedCostUsd: cases.reduce((sum, item) => sum + (item.estimatedCostUsd ?? 0), 0), severityMismatches: cases.reduce((sum, item) => sum + item.score.matches.filter((match) => !match.severityCorrect).length, 0) };
}
