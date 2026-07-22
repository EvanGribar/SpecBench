import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, relative, sep } from "node:path";
import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ExpectedFindingSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: SeveritySchema,
  file: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  requirementReference: z.string().min(1),
  /** Stable SpecBridge coordinates. Optional to preserve v0.1/v0.2 cases. */
  requirementId: z.string().min(1).optional(),
  criterionId: z.string().min(1).optional(),
  acceptableMatches: z.array(z.string().min(1)).default([])
}).refine((finding) => !finding.endLine || !finding.startLine || finding.endLine >= finding.startLine, {
  message: "endLine must not precede startLine", path: ["endLine"]
});

export const BenchmarkCaseSchema = z.object({
  schemaVersion: z.literal("1"),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  requirement: z.string().min(1),
  seededViolation: z.string().min(1).optional(),
  whyItMatters: z.string().min(1).optional(),
  repository: z.object({ baseCommit: z.string().min(1), patchPath: z.string().min(1) }),
  expectedFindings: z.array(ExpectedFindingSchema).min(1).superRefine((items, ctx) => {
    const seen = new Set<string>();
    const criteria = new Set<string>();
    items.forEach((item, index) => { if (seen.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate expected finding id", path: [index, "id"] }); seen.add(item.id); const key = item.requirementId && item.criterionId ? `${item.requirementId}:${item.criterionId}` : undefined; if (key && criteria.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate expected SpecBridge criterion mapping", path: [index, "criterionId"] }); if (key) criteria.add(key); });
  }),
  manualMappings: z.array(z.object({ expectedFindingId: z.string().min(1), findingId: z.string().min(1) })).default([]),
  distractors: z.array(z.object({ description: z.string().min(1), reasonNotAnIssue: z.string().min(1) })).default([])
});
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export const NormalizedFindingSchema = z.object({
  id: z.string().optional(), title: z.string().min(1), description: z.string().min(1), severity: z.string().optional(),
  file: z.string().optional(), startLine: z.number().int().positive().optional(), endLine: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(1).optional(), requirementReference: z.string().optional()
});
export type NormalizedFinding = z.infer<typeof NormalizedFindingSchema>;

export const SpecBridgeStatusSchema = z.enum(["satisfied", "violated", "not_verifiable", "not_applicable"]);
export type SpecBridgeStatus = z.infer<typeof SpecBridgeStatusSchema>;
export const CriterionResultSchema = z.object({
  requirementId: z.string().min(1), criterionId: z.string().min(1), status: SpecBridgeStatusSchema,
  explanation: z.string().min(1), confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(z.object({ path: z.string().min(1), startLine: z.number().int().positive(), endLine: z.number().int().positive().optional(), uri: z.string().url().optional() })).default([])
});
export type CriterionResult = z.infer<typeof CriterionResultSchema>;

export const ReviewOutputSchema = z.object({
  findings: z.array(NormalizedFindingSchema), raw: z.unknown().optional(), runtimeMs: z.number().nonnegative().optional(), estimatedCostUsd: z.number().nonnegative().optional(), metadata: z.record(z.unknown()).default({}), criterionResults: z.array(CriterionResultSchema).optional()
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
export type ReviewInput = { benchmarkVersion: string; case: BenchmarkCase; patch: string; dryRun?: boolean; maxOutputTokens?: number };
export type ReviewerAdapter = { name: string; version?: string; review(input: ReviewInput): Promise<ReviewOutput> };

export const RunResultSchema = z.object({
  schemaVersion: z.literal("1"), benchmarkVersion: z.string(), reviewer: z.object({ name: z.string(), version: z.string().optional() }),
  createdAt: z.string().optional().default(""), runId: z.string().optional(), configurationId: z.string().optional(), repetition: z.number().int().positive().optional(), startedAt: z.string().optional(), completedAt: z.string().optional(), configuration: z.record(z.unknown()).default({}), cases: z.array(z.object({ caseId: z.string(), raw: z.unknown(), output: ReviewOutputSchema }))
});
export type RunResult = z.infer<typeof RunResultSchema>;

/** Secret-free, committed description of one controlled v0.3 condition. */
export const ExperimentConfigurationSchema = z.object({
  schemaVersion: z.literal("1"), id: z.string().regex(/^[a-z0-9-]+$/), version: z.string().min(1),
  reviewerType: z.enum(["single-agent", "swarm-review"]), reviewerVersion: z.string().min(1), provider: z.string().min(1), model: z.string().min(1),
  temperature: z.number().min(0).max(2), maxOutputTokens: z.number().int().positive(), maxCalls: z.number().int().positive(), maxEstimatedCostUsd: z.number().positive(),
  agentCount: z.number().int().positive(), agentMandates: z.array(z.string().min(1)).min(1), debateRounds: z.number().int().min(0), confidenceThreshold: z.number().min(0).max(1),
  principal: z.record(z.unknown()), promptVersion: z.string().min(1), benchmarkVersion: z.literal("v0.2"), caseIds: z.array(z.string().min(1)).min(1), repetitions: z.number().int().positive(),
  environmentMetadataFields: z.array(z.string().min(1)).min(1), notes: z.string().min(1)
}).superRefine((config, ctx) => {
  if (config.reviewerType === "single-agent" && (config.agentCount !== 1 || config.debateRounds !== 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "single-agent must have one agent and zero debate rounds" });
  if (config.reviewerType === "swarm-review" && config.agentCount < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "swarm-review must have at least two agents" });
});
export type ExperimentConfiguration = z.infer<typeof ExperimentConfigurationSchema>;

export const AdjudicationRecordSchema = z.object({
  caseId: z.string(), runId: z.string(), submittedFindingId: z.string().nullable().optional(), expectedFindingId: z.string().nullable().optional(),
  automaticClassification: z.enum(["false-positive", "false-negative", "alias-match", "file-line-match", "duplicate", "severity-disagreement"]),
  humanClassification: z.enum(["correct-match", "valid-finding-missed-by-matcher", "invalid-finding", "duplicate", "partially-correct", "severity-disagreement", "ambiguous", "requires-case-revision"]),
  rationale: z.string().min(1), reviewer: z.string().min(1), timestamp: z.string().datetime()
});
export type AdjudicationRecord = z.infer<typeof AdjudicationRecordSchema>;

export function readCase(filePath: string): BenchmarkCase {
  return BenchmarkCaseSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
}
export function isSafeRelativePath(root: string, candidate: string): boolean {
  const target = resolve(root, candidate); const rel = relative(root, target); return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== "..";
}
export function validateCase(caseRoot: string, caseDefinition: BenchmarkCase): string[] {
  const errors: string[] = [];
  try { execFileSync("git", ["rev-parse", "--verify", `${caseDefinition.repository.baseCommit}^{commit}`], { stdio: "ignore" }); } catch { errors.push(`${caseDefinition.id}: baseCommit does not resolve to a local commit`); }
  if (!isSafeRelativePath(caseRoot, caseDefinition.repository.patchPath)) errors.push(`${caseDefinition.id}: patchPath escapes benchmark directory`);
  else if (!existsSync(resolve(caseRoot, caseDefinition.repository.patchPath))) errors.push(`${caseDefinition.id}: patch does not exist`);
  const patchFile = resolve(caseRoot, caseDefinition.repository.patchPath);
  const patch = existsSync(patchFile) ? readFileSync(patchFile, "utf8").replaceAll("\\", "/") : "";
  for (const finding of caseDefinition.expectedFindings) {
    if (finding.file.startsWith("/") || finding.file.includes("..")) errors.push(`${caseDefinition.id}/${finding.id}: invalid file reference`);
    else if (patch && !patch.includes(`b/${finding.file}`)) errors.push(`${caseDefinition.id}/${finding.id}: file is not changed by its patch`);
  }
  if (caseRoot.replaceAll("\\", "/").endsWith("/v0.2")) {
    if (!caseDefinition.seededViolation) errors.push(`${caseDefinition.id}: seededViolation is required for v0.2`);
    if (!caseDefinition.whyItMatters) errors.push(`${caseDefinition.id}: whyItMatters is required for v0.2`);
    if (!caseDefinition.distractors.length) errors.push(`${caseDefinition.id}: at least one distractor is required for v0.2`);
  }
  return errors;
}
