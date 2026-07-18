import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type LedgerEntryStatus = "reserved" | "settled" | "known-free" | "ambiguous-failure" | "released";
export type BudgetLedgerEntry = { id: string; timestamp: string; status: LedgerEntryStatus; runId?: string; configurationId?: string; caseId?: string; reservationId?: string; reservedUsd?: number; measuredUsd?: number; note?: string };
export type BudgetLedger = { schemaVersion: "1"; experimentId: string; currency: "USD"; ceilingUsd: number; measuredUsd: number; conservativelyCommittedUsd: number; updatedAt: string; entries: BudgetLedgerEntry[] };
export type BudgetStatus = { ceilingUsd: number; measuredUsd: number; conservativelyCommittedUsd: number; outstandingReservationsUsd: number; remainingUsd: number; updatedAt: string };
export class BudgetLedgerError extends Error {}

const terminal = new Set<LedgerEntryStatus>(["settled", "known-free", "released"]);
const retained = new Set<LedgerEntryStatus>(["reserved", "ambiguous-failure"]);
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function recordedSmokeMigration(): BudgetLedgerEntry {
  return { id: "migration-recorded-smoke-spend", timestamp: "2026-07-18T00:00:00.000Z", status: "settled", measuredUsd: 0.00132, note: "One-time migration of the $0.001320 aggregate from reliable terminal settlement logs. Exact per-call allocation for earlier no-output attempts was not preserved; this aggregate is the authoritative documented measured total." };
}

export class LiveBudgetLedger {
  constructor(readonly file: string, readonly lockTimeoutMs = 1_000) {}
  private get lockFile(): string { return `${this.file}.lock`; }
  private withLock<T>(work: () => T): T {
    const deadline = Date.now() + this.lockTimeoutMs;
    mkdirSync(dirname(this.file), { recursive: true });
    let fd: number | undefined;
    while (fd === undefined) {
      try { fd = openSync(this.lockFile, "wx"); writeFileSync(fd, "createdAt=local\n"); }
      catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        const age = (() => { try { return Date.now() - statSync(this.lockFile).mtimeMs; } catch { return 0; } })();
        if (Date.now() >= deadline) throw new BudgetLedgerError(`budget ledger lock timed out${age > this.lockTimeoutMs ? " (stale lock retained; remove only after confirming no live process is running)" : ""}`);
        pause(10);
      }
    }
    try { return work(); } finally { closeSync(fd); rmSync(this.lockFile, { force: true }); }
  }
  private read(): BudgetLedger {
    if (!existsSync(this.file)) throw new BudgetLedgerError(`budget ledger is missing: ${this.file}; initialize it explicitly before live calls`);
    let value: unknown;
    try { value = JSON.parse(readFileSync(this.file, "utf8")); } catch { throw new BudgetLedgerError("budget ledger is malformed; refusing live calls without repair"); }
    return validateLedger(value);
  }
  private write(ledger: BudgetLedger): void {
    ledger.updatedAt = new Date().toISOString(); validateLedger(ledger);
    const temp = `${this.file}.${randomUUID()}.tmp`;
    writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temp, this.file);
  }
  initializeRecordedSmokeSpend(): BudgetLedger {
    return this.withLock(() => {
      if (existsSync(this.file)) throw new BudgetLedgerError(`budget ledger already exists: ${this.file}`);
      const entry = recordedSmokeMigration();
      const ledger: BudgetLedger = { schemaVersion: "1", experimentId: "specbench-v0.3-live-smoke-test", currency: "USD", ceilingUsd: 1, measuredUsd: entry.measuredUsd!, conservativelyCommittedUsd: 0, updatedAt: entry.timestamp, entries: [entry] };
      this.write(ledger); return ledger;
    });
  }
  audit(): BudgetStatus {
    return this.withLock(() => statusFor(this.read()));
  }
  reserve(amountUsd: number, details: Pick<BudgetLedgerEntry, "runId" | "configurationId" | "caseId"> = {}): BudgetLedgerEntry {
    if (!Number.isFinite(amountUsd) || amountUsd < 0) throw new BudgetLedgerError("reservation must be a nonnegative finite USD amount");
    return this.withLock(() => {
      const ledger = this.read(); const status = statusFor(ledger);
      if (status.remainingUsd + 1e-12 < amountUsd) throw new BudgetLedgerError("hard live-smoke budget would be exceeded before this call");
      const entry: BudgetLedgerEntry = { id: randomUUID(), timestamp: new Date().toISOString(), status: "reserved", reservedUsd: amountUsd, ...details };
      ledger.entries.push(entry); ledger.conservativelyCommittedUsd += amountUsd; this.write(ledger); return entry;
    });
  }
  settle(reservationId: string, measuredUsd: number, note = "provider usage settled"): BudgetStatus {
    if (!Number.isFinite(measuredUsd) || measuredUsd < 0) throw new BudgetLedgerError("measured cost must be a nonnegative finite USD amount");
    return this.transition(reservationId, "settled", { measuredUsd, note });
  }
  retainAmbiguous(reservationId: string, note = "provider outcome or usage is ambiguous; reservation retained"): BudgetStatus { return this.transition(reservationId, "ambiguous-failure", { note }); }
  releaseKnownFree(reservationId: string, note = "definitely pre-request failure; reservation released"): BudgetStatus { return this.transition(reservationId, "released", { note }); }
  private transition(reservationId: string, status: LedgerEntryStatus, extra: Partial<BudgetLedgerEntry>): BudgetStatus {
    return this.withLock(() => {
      const ledger = this.read(); const reservation = ledger.entries.find((entry) => entry.id === reservationId);
      if (!reservation || !retained.has(reservation.status)) throw new BudgetLedgerError("reservation is missing or already terminal");
      const reservedUsd = reservation.reservedUsd ?? 0;
      reservation.status = status; Object.assign(reservation, extra); ledger.conservativelyCommittedUsd -= reservedUsd;
      if (status === "settled") ledger.measuredUsd += extra.measuredUsd ?? 0;
      if (status === "ambiguous-failure") ledger.conservativelyCommittedUsd += reservedUsd;
      this.write(ledger); return statusFor(ledger);
    });
  }
}

function validateLedger(value: unknown): BudgetLedger {
  const ledger = value as BudgetLedger;
  if (!ledger || ledger.schemaVersion !== "1" || ledger.currency !== "USD" || ledger.experimentId !== "specbench-v0.3-live-smoke-test" || !Array.isArray(ledger.entries)) throw new BudgetLedgerError("budget ledger schema is invalid; refusing live calls");
  for (const field of [ledger.ceilingUsd, ledger.measuredUsd, ledger.conservativelyCommittedUsd]) if (!Number.isFinite(field) || field < 0) throw new BudgetLedgerError("budget ledger totals are invalid");
  const ids = new Set<string>(); for (const entry of ledger.entries) { if (!entry.id || ids.has(entry.id) || !["reserved", "settled", "known-free", "ambiguous-failure", "released"].includes(entry.status)) throw new BudgetLedgerError("budget ledger entries are invalid or duplicated"); ids.add(entry.id); }
  const calculatedMeasured = ledger.entries.filter((e) => e.status === "settled").reduce((sum, e) => sum + (e.measuredUsd ?? 0), 0);
  const calculatedCommitted = ledger.entries.filter((e) => retained.has(e.status)).reduce((sum, e) => sum + (e.reservedUsd ?? 0), 0);
  if (Math.abs(calculatedMeasured - ledger.measuredUsd) > 1e-9 || Math.abs(calculatedCommitted - ledger.conservativelyCommittedUsd) > 1e-9) throw new BudgetLedgerError("budget ledger summary does not reconcile with its audit entries");
  return ledger;
}
function statusFor(ledger: BudgetLedger): BudgetStatus {
  const outstanding = ledger.entries.filter((e) => e.status === "reserved").reduce((sum, e) => sum + (e.reservedUsd ?? 0), 0);
  const remaining = ledger.ceilingUsd - ledger.measuredUsd - ledger.conservativelyCommittedUsd;
  if (remaining < -1e-9) throw new BudgetLedgerError("budget ledger exceeds its ceiling");
  return { ceilingUsd: ledger.ceilingUsd, measuredUsd: ledger.measuredUsd, conservativelyCommittedUsd: ledger.conservativelyCommittedUsd, outstandingReservationsUsd: outstanding, remainingUsd: remaining, updatedAt: ledger.updatedAt };
}
