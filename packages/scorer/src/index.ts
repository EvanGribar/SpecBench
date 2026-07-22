import type { BenchmarkCase, CriterionResult, NormalizedFinding, Severity } from "../../core/src/index.js";

const weights: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
export type Match = { expectedId: string; findingIndex: number; method: "id" | "line" | "alias"; severityCorrect: boolean };
export type CaseScore = { caseId: string; matches: Match[]; falsePositiveIndexes: number[]; missedFindingIds: string[]; expectedCount: number; submittedCount: number; runtimeMs?: number; estimatedCostUsd?: number };
export type CriterionScore = { truePositives: number; falsePositives: number; falseNegatives: number; abstentions: number; applicabilityErrors: number; contradictions: number; statusCounts: Record<string, number>; coverageRate: number | null; evidencedViolationRate: number | null; rows: Array<{ expectedId?: string; requirementId: string; criterionId: string; expected: boolean; reported: string; match: string; evidence: "valid" | "missing" }> };
export type AggregateMetrics = { truePositives: number; falsePositives: number; falseNegatives: number; precision: number | null; recall: number | null; f1: number | null; severityWeightedRecall: number | null; criticalIssueDetectionRate: number | null; averageFindingsPerCase: number; runtimeMs: number; estimatedCostUsd: number; severityMismatches: number; criterion_true_positives?: number; criterion_false_positives?: number; criterion_false_negatives?: number; criterion_precision?: number | null; criterion_recall?: number | null; criterion_f1?: number | null; criterion_abstentions?: number; criterion_applicability_errors?: number; criterion_contradictions?: number; criterion_coverage_rate?: number | null; evidenced_violation_rate?: number | null; criterion_status_counts?: Record<string, number> };

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

/** Scores every SpecBridge status without collapsing it into a boolean finding. */
export function matchCriterionCase(benchmarkCase: BenchmarkCase, results: CriterionResult[]): CriterionScore {
  const expected = benchmarkCase.expectedFindings.filter((finding) => finding.criterionId);
  const mapped = new Map(expected.map((finding) => [`${finding.requirementId ?? finding.requirementReference}:${finding.criterionId}`, finding]));
  const statusCounts = Object.fromEntries(["satisfied", "violated", "not_verifiable", "not_applicable"].map((status) => [status, 0])) as Record<string, number>;
  let truePositives = 0, falsePositives = 0, falseNegatives = 0, abstentions = 0, applicabilityErrors = 0, contradictions = 0;
  const rows: CriterionScore["rows"] = [];
  const matched = new Set<string>();
  for (const result of results) {
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
    const key = `${result.requirementId}:${result.criterionId}`; const finding = mapped.get(key);
    const evidence = result.evidence.length ? "valid" : "missing";
    if (!finding) { if (result.status === "violated") falsePositives++; rows.push({ requirementId: result.requirementId, criterionId: result.criterionId, expected: false, reported: result.status, match: result.status === "violated" ? "false-positive" : "unmapped", evidence }); continue; }
    matched.add(finding.id);
    if (result.status === "violated") { truePositives++; rows.push({ expectedId: finding.id, requirementId: result.requirementId, criterionId: result.criterionId, expected: true, reported: result.status, match: "true-positive", evidence }); }
    else { falseNegatives++; if (result.status === "satisfied") contradictions++; if (result.status === "not_verifiable") abstentions++; if (result.status === "not_applicable") applicabilityErrors++; rows.push({ expectedId: finding.id, requirementId: result.requirementId, criterionId: result.criterionId, expected: true, reported: result.status, match: "false-negative", evidence }); }
  }
  for (const finding of expected.filter((item) => !matched.has(item.id))) { falseNegatives++; rows.push({ expectedId: finding.id, requirementId: finding.requirementId ?? finding.requirementReference, criterionId: finding.criterionId!, expected: true, reported: "missing", match: "false-negative", evidence: "missing" }); }
  const violated = results.filter((item) => item.status === "violated");
  return { truePositives, falsePositives, falseNegatives, abstentions, applicabilityErrors, contradictions, statusCounts, coverageRate: expected.length ? matched.size / expected.length : null, evidencedViolationRate: violated.length ? violated.filter((item) => item.evidence.length > 0).length / violated.length : null, rows };
}

export function aggregateScores(cases: Array<{ benchmarkCase: BenchmarkCase; score: CaseScore; runtimeMs?: number; estimatedCostUsd?: number; criterionScore?: CriterionScore }>): AggregateMetrics {
  const truePositives = cases.reduce((sum, item) => sum + item.score.matches.length, 0); const falsePositives = cases.reduce((sum, item) => sum + item.score.falsePositiveIndexes.length, 0); const falseNegatives = cases.reduce((sum, item) => sum + item.score.missedFindingIds.length, 0); const expected = cases.flatMap((item) => item.benchmarkCase.expectedFindings); const matchedIds = new Set(cases.flatMap((item) => item.score.matches.map((match) => match.expectedId)));
  const weightedTotal = expected.reduce((sum, item) => sum + weights[item.severity], 0); const weightedDetected = expected.filter((item) => matchedIds.has(item.id)).reduce((sum, item) => sum + weights[item.severity], 0); const critical = expected.filter((item) => item.severity === "critical");
  const precision = truePositives + falsePositives ? truePositives / (truePositives + falsePositives) : null; const recall = truePositives + falseNegatives ? truePositives / (truePositives + falseNegatives) : null;
  const criterion = cases.map((item) => item.criterionScore).filter((item): item is CriterionScore => Boolean(item)); const ctp = criterion.reduce((sum, item) => sum + item.truePositives, 0), cfp = criterion.reduce((sum, item) => sum + item.falsePositives, 0), cfn = criterion.reduce((sum, item) => sum + item.falseNegatives, 0); const cp = ctp + cfp ? ctp / (ctp + cfp) : null, cr = ctp + cfn ? ctp / (ctp + cfn) : null;
  const base = { truePositives, falsePositives, falseNegatives, precision, recall, f1: precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null, severityWeightedRecall: weightedTotal ? weightedDetected / weightedTotal : null, criticalIssueDetectionRate: critical.length ? critical.filter((item) => matchedIds.has(item.id)).length / critical.length : null, averageFindingsPerCase: cases.length ? cases.reduce((sum, item) => sum + item.score.submittedCount, 0) / cases.length : 0, runtimeMs: cases.reduce((sum, item) => sum + (item.runtimeMs ?? 0), 0), estimatedCostUsd: cases.reduce((sum, item) => sum + (item.estimatedCostUsd ?? 0), 0), severityMismatches: cases.reduce((sum, item) => sum + item.score.matches.filter((match) => !match.severityCorrect).length, 0) };
  if (!criterion.length) return base;
  const average = (values: Array<number | null>) => values.length && values.every((v) => v !== null) ? values.reduce((sum, value) => sum + value!, 0) / values.length : null;
  return { ...base, criterion_true_positives: ctp, criterion_false_positives: cfp, criterion_false_negatives: cfn, criterion_precision: cp, criterion_recall: cr, criterion_f1: cp !== null && cr !== null && cp + cr ? 2 * cp * cr / (cp + cr) : null, criterion_abstentions: criterion.reduce((sum, item) => sum + item.abstentions, 0), criterion_applicability_errors: criterion.reduce((sum, item) => sum + item.applicabilityErrors, 0), criterion_contradictions: criterion.reduce((sum, item) => sum + item.contradictions, 0), criterion_coverage_rate: average(criterion.map((item) => item.coverageRate)), evidenced_violation_rate: average(criterion.map((item) => item.evidencedViolationRate)), criterion_status_counts: Object.fromEntries(["satisfied", "violated", "not_verifiable", "not_applicable"].map((status) => [status, criterion.reduce((sum, item) => sum + (item.statusCounts[status] ?? 0), 0)])) };
}
