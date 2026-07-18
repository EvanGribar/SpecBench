import { readFileSync } from "node:fs";
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { NormalizedFindingSchema, type ReviewInput, type ReviewOutput, type ReviewerAdapter } from "../../core/src/index.js";

export function normalizeFindings(input: unknown[]): ReturnType<typeof NormalizedFindingSchema.parse>[] {
  return input.map((finding) => NormalizedFindingSchema.parse(finding));
}

export class JsonFileAdapter implements ReviewerAdapter {
  name = "json-file";
  version?: string;
  constructor(private readonly resultFile: string) {}
  async review(input: ReviewInput): Promise<ReviewOutput> {
    const source = JSON.parse(readFileSync(this.resultFile, "utf8"));
    const selected = source.cases?.[input.case.id] ?? source;
    return { findings: normalizeFindings(selected.findings ?? selected), raw: selected, runtimeMs: selected.runtimeMs ?? source.runtimeMs, estimatedCostUsd: selected.estimatedCostUsd ?? source.estimatedCostUsd, metadata: { source: this.resultFile } };
  }
}

export class SwarmReviewAdapter implements ReviewerAdapter {
  name = "swarm-review";
  constructor(private readonly resultFile: string, public version?: string) {}
  async review(input: ReviewInput): Promise<ReviewOutput> {
    const source = JSON.parse(readFileSync(this.resultFile, "utf8"));
    const selected = source.cases?.[input.case.id] ?? source;
    const findings = selected.findings ?? selected.issues ?? [];
    return { findings: normalizeFindings(findings.map((item: Record<string, unknown>) => ({ title: item.title ?? item.message ?? "Untitled finding", description: item.description ?? item.body ?? "", severity: item.severity, file: item.file ?? item.path, startLine: item.startLine ?? item.line, endLine: item.endLine, confidence: item.confidence, requirementReference: item.requirementReference }))), raw: selected, runtimeMs: selected.runtimeMs ?? source.runtimeMs, estimatedCostUsd: selected.estimatedCostUsd ?? source.estimatedCostUsd, metadata: { source: this.resultFile, caseId: input.case.id } };
  }
}

/** Opt-in BYO-key adapter. It deliberately makes no provider call in fixture/dry-run mode. */
export class SingleAgentAdapter implements ReviewerAdapter {
  name = "single-agent";
  constructor(public version = "ai-sdk-v6", private readonly model = process.env.SPECBENCH_MODEL ?? "gpt-5-mini") {}
  async review(input: ReviewInput): Promise<ReviewOutput> {
    if (input.dryRun) return { findings: [], metadata: { dryRun: true } };
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for the single-agent adapter; use --fixture or --dry-run for offline execution.");
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const started = performance.now();
    const { output, usage } = await generateText({
      model: openai(this.model),
      maxOutputTokens: input.maxOutputTokens,
      output: Output.object({ schema: z.object({ findings: z.array(NormalizedFindingSchema) }) }),
      prompt: `You are reviewing a proposed change for product-requirement violations. Report only concrete violations.\n\nRequirement:\n${input.case.requirement}\n\nPatch:\n${input.patch}`
    });
    return { findings: output.findings, raw: output, runtimeMs: Math.round(performance.now() - started), metadata: { model: this.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } };
  }
}
