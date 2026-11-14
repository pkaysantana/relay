/**
 * Integration points for FUTURE extensions. Interfaces only — nothing here is implemented yet.
 * Any implementation must keep a human in the loop: extracted or proposed data is a draft
 * that a clinician confirms via the normal engine commands (confirmSenderInfo, sendTransfer…).
 *
 * OWNER: future capacity & scheduling / integrations.
 */
import type { DemoState, EntryMethod, ISODateTime, SourceDocument, TransferEpisode } from "@/core/types";
import type { ExtractedField } from "@/extraction/labelledParser";

/**
 * Document -> extracted fields with VERBATIM evidence (quote + offsets). Output is never
 * auto-confirmed; the engine rejects any quote that is not found verbatim in the document.
 * Implemented: deterministic labelled parser (src/extraction). Future: OCR / model-based.
 */
export interface TransferExtractor {
  readonly id: string;
  readonly method: EntryMethod;
  extract(document: SourceDocument): Promise<{ fields: ExtractedField[]; warnings: string[] }>;
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
