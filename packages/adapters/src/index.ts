import { readFileSync } from "node:fs";
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { NormalizedFindingSchema, type NormalizedFinding, type ReviewInput, type ReviewOutput, type ReviewerAdapter } from "../../core/src/index.js";
import { LiveBudgetLedger, type BudgetStatus } from "./live-budget-ledger.js";

type Usage = { inputTokens?: number; outputTokens?: number };
let liveBudget: { ledger: LiveBudgetLedger; inputRate: number; outputRate: number; details: { runId?: string; configurationId?: string; caseId?: string } } | undefined;
export function configureLiveBudget(ledgerFile: string, inputRate: number, outputRate: number, details: { runId?: string; configurationId?: string; caseId?: string } = {}): void { liveBudget = { ledger: new LiveBudgetLedger(ledgerFile), inputRate, outputRate, details }; }
export function liveBudgetStatus(): BudgetStatus | undefined { return liveBudget?.ledger.audit(); }
function reserve(prompt: string, maxOutputTokens: number | undefined) {
  if (!liveBudget) return undefined; const inputTokens = Math.ceil(prompt.length / 2); const cost = (inputTokens * liveBudget.inputRate + (maxOutputTokens ?? 0) * liveBudget.outputRate) / 1_000_000;
  return liveBudget.ledger.reserve(cost, liveBudget.details);
}
async function budgetedGenerate(options: Parameters<typeof generateText>[0] & { prompt: string; maxOutputTokens?: number }) {
  const reservation = reserve(options.prompt, options.maxOutputTokens);
  try {
    const response = await generateText(options);
    if (reservation && liveBudget) {
      if (response.usage.inputTokens === undefined || response.usage.outputTokens === undefined) {
        const status = liveBudget.ledger.retainAmbiguous(reservation.id, "successful provider response without reliable usage; reservation retained");
        Object.assign(response, { specbenchBudget: { status: "conservatively reserved", reservationId: reservation.id, reservedUsd: reservation.reservedUsd, ledger: status } });
      } else {
        const actual = ((response.usage.inputTokens * liveBudget.inputRate) + (response.usage.outputTokens * liveBudget.outputRate)) / 1_000_000;
        const status = liveBudget.ledger.settle(reservation.id, actual);
        Object.assign(response, { specbenchBudget: { status: "measured", reservationId: reservation.id, measuredUsd: actual, ledger: status } });
      }
    }
    return response;
  } catch (error) {
    if (reservation && liveBudget) { const status = liveBudget.ledger.retainAmbiguous(reservation.id); Object.assign(error as object, { specbenchBudget: { status: "conservatively reserved", reservationId: reservation.id, reservedUsd: reservation.reservedUsd, ledger: status } }); }
    throw error;
  }
}

export function normalizeFindings(input: unknown[]): ReturnType<typeof NormalizedFindingSchema.parse>[] {
  return input.map((finding) => NormalizedFindingSchema.parse(finding));
}
function estimatedCost(usage: { inputTokens?: number; outputTokens?: number }): number | undefined {
  const inputRate = Number(process.env.SPECBENCH_INPUT_USD_PER_MILLION); const outputRate = Number(process.env.SPECBENCH_OUTPUT_USD_PER_MILLION);
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate < 0 || outputRate < 0) return undefined;
  return ((usage.inputTokens ?? 0) * inputRate + (usage.outputTokens ?? 0) * outputRate) / 1_000_000;
}
const StructuredFindingSchema = z.object({ title: z.string(), description: z.string(), severity: z.string().nullable(), file: z.string().nullable(), startLine: z.number().int().positive().nullable(), endLine: z.number().int().positive().nullable(), requirementReference: z.string().nullable() }).transform((finding) => NormalizedFindingSchema.parse(Object.fromEntries(Object.entries(finding).filter(([, value]) => value !== null))));
const StructuredOutputSchema = z.object({ findings: z.array(StructuredFindingSchema) });

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
    const { output, usage } = await budgetedGenerate({
      model: openai(this.model),
      maxOutputTokens: input.maxOutputTokens, providerOptions: { openai: { reasoningEffort: "minimal" } },
      output: Output.object({ schema: StructuredOutputSchema }),
      prompt: `You are reviewing a proposed change for product-requirement violations. Report only concrete violations.\n\nRequirement:\n${input.case.requirement}\n\nPatch:\n${input.patch}`
    });
    return { findings: output.findings, raw: output, runtimeMs: Math.round(performance.now() - started), estimatedCostUsd: estimatedCost(usage), metadata: { model: this.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, pricingConfigured: estimatedCost(usage) !== undefined } };
  }
}

/** Uses the same model and output contract as the baseline; only the review architecture changes. */
export class ControlledSwarmAdapter implements ReviewerAdapter {
  name = "swarm-review";
  constructor(private readonly debateRounds: number, public version = "controlled-swarm-v0.3", private readonly model = process.env.SPECBENCH_MODEL ?? "gpt-5-mini") {}
  async review(input: ReviewInput): Promise<ReviewOutput> {
    if (input.dryRun) return { findings: [], metadata: { dryRun: true, model: this.model, debateRounds: this.debateRounds } };
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for live experiments; use experiment --dry-run or --fixture for offline execution.");
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY }); const started = performance.now();
    const schema = StructuredOutputSchema; const context = `Requirement:\n${input.case.requirement}\n\nPatch:\n${input.patch}`;
    const mandates = ["authorization and state transitions", "user-visible product behavior", "data integrity and audit requirements"];
    const reviewers = [] as Array<{ findings: NormalizedFinding[]; usage: { inputTokens?: number; outputTokens?: number } }>;
    for (const mandate of mandates) { const response = await budgetedGenerate({ model: openai(this.model), maxOutputTokens: input.maxOutputTokens, providerOptions: { openai: { reasoningEffort: "minimal" } }, output: Output.object({ schema }), prompt: `You are one independent code reviewer specializing in ${mandate}. Identify only explicit product-requirement violations using the common finding schema.\n\n${context}` }); reviewers.push({ findings: response.output.findings, usage: response.usage }); }
    let candidates = reviewers.flatMap((reviewer) => reviewer.findings);
    for (let round = 0; round < this.debateRounds; round++) { const response = await budgetedGenerate({ model: openai(this.model), maxOutputTokens: input.maxOutputTokens, providerOptions: { openai: { reasoningEffort: "minimal" } }, output: Output.object({ schema }), prompt: `You are a debate round for a code review. Reconsider these candidate findings against the explicit requirement and patch; retain only defensible findings in the common schema.\n\n${context}\n\nCandidates:\n${JSON.stringify(candidates)}` }); candidates = response.output.findings; reviewers.push({ findings: candidates, usage: response.usage }); }
    const principal = await budgetedGenerate({ model: openai(this.model), maxOutputTokens: input.maxOutputTokens, providerOptions: { openai: { reasoningEffort: "minimal" } }, output: Output.object({ schema }), prompt: `You are the principal reviewer. Consolidate these independent candidate findings against the requirement and patch. Emit only concrete violations in the common schema; do not invent issues.\n\n${context}\n\nCandidates:\n${JSON.stringify(candidates)}` });
    const usage = [...reviewers.map((item) => item.usage), principal.usage];
    const totalUsage = { inputTokens: usage.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0), outputTokens: usage.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0) };
    return { findings: principal.output.findings, raw: { reviewers: reviewers.map((item) => item.findings), principal: principal.output.findings }, runtimeMs: Math.round(performance.now() - started), estimatedCostUsd: estimatedCost(totalUsage), metadata: { model: this.model, ...totalUsage, pricingConfigured: estimatedCost(totalUsage) !== undefined, debateRounds: this.debateRounds, providerCalls: usage.length } };
  }
}
