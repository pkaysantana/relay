/**
 * Integration points for FUTURE extensions. Interfaces only — nothing here is implemented yet.
 * Any implementation must keep a human in the loop: extracted or proposed data is a draft
 * that a clinician confirms via the normal engine commands (confirmSenderInfo, sendTransfer…).
 *
 * OWNER: future capacity & scheduling / integrations.
 */
import type { DemoState, ISODateTime, TransferEpisode } from "@/core/types";
import type { PathwayPack } from "@/packs/types";

/** Document -> structured draft fields (e.g. rule parser or LLM). Output is never auto-confirmed. */
export interface TransferExtractor {
  readonly id: string;
  extract(document: string, pack: PathwayPack): Promise<{
    fields: Record<string, string>;
    /** Per-field provenance so the reviewer can see where each value came from. */
    sources: Record<string, string>;
    warnings: string[];
  }>;
}

/** Simulated (later real) community capacity, e.g. Heim visit slots. Proposals only. */
export interface CapacityProvider {
  readonly id: string;
  listAvailability(orgId: string, from: ISODateTime, to: ISODateTime): Promise<
    { start: ISODateTime; end: ISODateTime; practitionerId?: string }[]
  >;
}

/** Real FHIR server adapter (post/poll Tasks). Must not be wired in without validation work. */
export interface FhirClient {
  postBundle(bundle: Record<string, unknown>): Promise<{ ok: boolean; message: string }>;
  pollTaskStatus(taskId: string): Promise<string | null>;
}

/** Hook for future disease-specific behaviour beyond pack configuration (avoid if config suffices). */
export interface PackBehaviour {
  packId: string;
  onTransferConfirmed?(state: DemoState, transfer: TransferEpisode): string[]; // advisory messages only
}
