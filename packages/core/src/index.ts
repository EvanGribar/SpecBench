import { existsSync, readFileSync } from "node:fs";
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
  repository: z.object({ baseCommit: z.string().min(1), patchPath: z.string().min(1) }),
  expectedFindings: z.array(ExpectedFindingSchema).min(1).superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => { if (seen.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate expected finding id", path: [index, "id"] }); seen.add(item.id); });
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

export const ReviewOutputSchema = z.object({
  findings: z.array(NormalizedFindingSchema), raw: z.unknown().optional(), runtimeMs: z.number().nonnegative().optional(), estimatedCostUsd: z.number().nonnegative().optional(), metadata: z.record(z.unknown()).default({})
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
export type ReviewInput = { benchmarkVersion: string; case: BenchmarkCase; patch: string; dryRun?: boolean; maxOutputTokens?: number };
export type ReviewerAdapter = { name: string; version?: string; review(input: ReviewInput): Promise<ReviewOutput> };

export const RunResultSchema = z.object({
  schemaVersion: z.literal("1"), benchmarkVersion: z.string(), reviewer: z.object({ name: z.string(), version: z.string().optional() }),
  createdAt: z.string(), configuration: z.record(z.unknown()).default({}), cases: z.array(z.object({ caseId: z.string(), raw: z.unknown(), output: ReviewOutputSchema }))
});
export type RunResult = z.infer<typeof RunResultSchema>;

export function readCase(filePath: string): BenchmarkCase {
  return BenchmarkCaseSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
}
export function isSafeRelativePath(root: string, candidate: string): boolean {
  const target = resolve(root, candidate); const rel = relative(root, target); return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== "..";
}
export function validateCase(caseRoot: string, caseDefinition: BenchmarkCase): string[] {
  const errors: string[] = [];
  if (!isSafeRelativePath(caseRoot, caseDefinition.repository.patchPath)) errors.push(`${caseDefinition.id}: patchPath escapes benchmark directory`);
  else if (!existsSync(resolve(caseRoot, caseDefinition.repository.patchPath))) errors.push(`${caseDefinition.id}: patch does not exist`);
  const patchFile = resolve(caseRoot, caseDefinition.repository.patchPath);
  const patch = existsSync(patchFile) ? readFileSync(patchFile, "utf8").replaceAll("\\", "/") : "";
  for (const finding of caseDefinition.expectedFindings) {
    if (finding.file.startsWith("/") || finding.file.includes("..")) errors.push(`${caseDefinition.id}/${finding.id}: invalid file reference`);
    else if (patch && !patch.includes(`b/${finding.file}`)) errors.push(`${caseDefinition.id}/${finding.id}: file is not changed by its patch`);
  }
  return errors;
}
