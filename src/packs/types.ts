/**
 * Pathway pack contract. A pack supplies CONFIGURATION ONLY — the core engine is shared.
 * Adding a clinical niche = add src/packs/<name>.ts and register it in src/packs/index.ts.
 *
 * Packs must not contain disease prediction, medication-safety algorithms or urgency scoring.
 * Timings are suggestions that a human clinician must confirm before a transfer is sent.
 *
 * OWNER: clinical packs.
 */
import type { CareTask, DemoState, TransferEpisode } from "@/core/types";

export interface PackField {
  key: string;
  label: string;
  help?: string;
  /** Multiline input in the UI. */
  long?: boolean;
}

export interface PackRole {
  code: string;
  label: string;
}

export interface TaskTemplate {
  id: string;
  label: string;
  /** Role code from PathwayPack.roles. */
  ownerRole: string;
  /**
   * Suggested hours after transfer initiation. A placeholder only — the sending clinician
   * confirms or edits every deadline before sending. Omit to force manual entry.
   */
  suggestedDueHours?: number;
  /** Shown next to the deadline so nobody mistakes the placeholder for clinical advice. */
  timingNote: string;
  /** Guideline / evidence reference text (displayed, never enforced). */
  evidenceRef?: string;
  /** Completion of this task counts as "first care contact" for metrics. */
  marksFirstCareContact?: boolean;
}

export interface QualityMeasureResult {
  numerator: number;
  denominator: number;
}

export interface QualityMeasure {
  id: string;
  label: string;
  description: string;
  evaluate(ctx: {
    state: DemoState;
    transfers: TransferEpisode[];
    tasks: CareTask[];
  }): QualityMeasureResult;
}

export interface PathwayPack {
  id: string;
  name: string;
  description: string;
  /** Must be present before the receiving organisation can accept the transfer. */
  requiredFields: PackField[];
  /** Optional additional fields shown on the handover. */
  extraFields: PackField[];
  roles: PackRole[];
  taskTemplates: TaskTemplate[];
  references: { label: string; note?: string }[];
  qualityMeasures: QualityMeasure[];
}
