/**
 * Doorstep application domain model.
 *
 * This is deliberately NOT a FHIR model. FHIR R4 (Task, Patient, ServiceRequest,
 * Organization, PractitionerRole) is the reference for naming and status values,
 * but serialisation lives in src/fhir/. Keep these two layers separate.
 *
 * OWNER: core model & state transitions. Changes here affect every view — announce them.
 */

export type ISODateTime = string;
export type Id = string;

/** FHIR R4 Task.status values used by Doorstep. "Overdue" is NOT a status — see selectors.isOverdue. */
export const TASK_STATUSES = [
  "draft",
  "requested",
  "received",
  "accepted",
  "rejected",
  "in-progress",
  "on-hold",
  "completed",
  "failed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Transfer episode lifecycle. Each step is a distinct event:
 * sent ≠ received (acknowledged) ≠ accepted (responsibility taken) ≠ any task completed.
 */
export const TRANSFER_STATUSES = [
  "draft", // sending team still reviewing
  "info-confirmed", // sending team confirmed the information
  "handover-ready", // structured handover (tasks) generated, deadlines not yet confirmed
  "sent", // transfer initiated to a receiving organisation
  "received", // receiving organisation acknowledged receipt (NOT acceptance)
  "clarification-requested",
  "accepted", // receiving organisation accepted responsibility, named professional
  "rejected", // receiving organisation declined — unresolved until redirected
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export type OrgType = "acute" | "community" | "primary-care" | "social-care" | "specialist" | "independent";

/** Transfer context only — not clinical eligibility and not the decision to transfer. */
export const TRANSFER_KINDS = ["discharge", "referral", "provider-move"] as const;
export type TransferKind = (typeof TRANSFER_KINDS)[number];

/** A synthetic source document (prepared or pasted). Never real patient data. */
export interface SourceDocument {
  id: Id;
  title: string;
  text: string;
  addedAt: ISODateTime;
}

/** Verbatim support for a value: quote === document.text.slice(start, end). */
export interface FieldEvidence {
  documentId: Id;
  quote: string;
  start: number;
  end: number;
  /** Normalised value read from this quote. */
  value: string;
}

export type EntryMethod = "manual" | "deterministic-extraction" | "ai-extraction";

export interface HandoverField {
  key: string;
  value: string;
  entryMethod: EntryMethod;
  /** Empty for manual entries — never fabricate a quotation. >1 distinct values = conflict. */
  evidence: FieldEvidence[];
  /** Why the extractor considered the value ambiguous (e.g. "TBC"). */
  ambiguity?: string;
  confirmedBy?: Id;
  confirmedRole?: string;
  confirmedAt?: ISODateTime;
  updatedBy: Id;
  updatedAt: ISODateTime;
}

export interface Handover {
  transferKind: TransferKind;
  receiverProfileId: string;
  documentIds: Id[];
  fields: Record<string, HandoverField>;
  extractionWarnings: string[];
  /** Manual identity check, only permitted when identifiers are absent (never overrides a mismatch). */
  identityCheck?: { by: Id; at: ISODateTime; note: string };
}

export interface Organization {
  id: Id;
  name: string;
  type: OrgType;
}

/** A professional acting in a role at an organisation (FHIR PractitionerRole). */
export interface Practitioner {
  id: Id;
  name: string;
  /** Role code, matched against pack roles (e.g. "receiving-clinician"). */
  role: string;
  orgId: Id;
}

/** Synthetic patient only. Never store real identifiers. */
export interface Patient {
  id: Id;
  syntheticId: string;
  displayName: string;
  birthYear: number;
  /** Synthetic NHS-number-shaped identifier (999 test range). */
  nhsNumber?: string;
  /** ISO date YYYY-MM-DD. */
  birthDate?: string;
}

export interface Evidence {
  summary: string;
  kind: "contact-note" | "observation" | "document-ref" | "other";
  /** When the action actually happened (may precede recording). */
  occurredAt: ISODateTime;
  recordedAt: ISODateTime;
  recordedBy: Id;
  /** Event that recorded this evidence — the evidence is preserved in the event log. */
  eventId: Id;
}

export interface Blocker {
  id: Id;
  note: string;
  raisedBy: Id;
  raisedAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

export interface Escalation {
  id: Id;
  at: ISODateTime;
  by: Id;
  note: string;
  escalatedToPractitionerId?: Id;
}

export interface TransferDecision {
  outcome: "accepted" | "rejected" | "clarification-requested";
  by: Id;
  at: ISODateTime;
  reason?: string;
}

export interface TransferEpisode {
  id: Id;
  patientId: Id;
  packId: string;
  sendingOrgId: Id;
  /** Original clinical responsibility — remains visible throughout. */
  sendingPractitionerId: Id;
  receivingOrgId?: Id;
  /** Named professional who accepted responsibility. Required for acceptance. */
  receivingPractitionerId?: Id;
  plannedDischargeAt: ISODateTime;
  /** Pack-defined transfer fields (required + optional extra fields). */
  fields: Record<string, string>;
  status: TransferStatus;
  senderConfirmedBy?: Id;
  senderConfirmedAt?: ISODateTime;
  initiatedAt?: ISODateTime;
  acknowledgedAt?: ISODateTime;
  acceptedAt?: ISODateTime;
  decisions: TransferDecision[];
  clarificationQuestion?: string;
  /** Evidence-aware handover validated against a receiver profile. Absent = legacy pack-field transfer. */
  handover?: Handover;
  senderConfirmedRole?: string;
}

export interface CareTask {
  id: Id;
  transferId: Id;
  templateId: string;
  description: string;
  ownerRole: string;
  ownerOrgId?: Id;
  /** Named owner. A task cannot be accepted without one. */
  ownerPractitionerId?: Id;
  /** Original requester (sending professional) — never overwritten by reassignment. */
  requesterPractitionerId: Id;
  /** Deadline. Must be confirmed by a human before sending. */
  dueAt?: ISODateTime;
  dueConfirmedBy?: Id;
  timingNote: string;
  marksFirstCareContact: boolean;
  status: TaskStatus;
  statusReason?: string;
  /** Human-entered planned date. Scheduling is NOT completion. */
  scheduledFor?: ISODateTime;
  acceptedAt?: ISODateTime;
  completedAt?: ISODateTime;
  evidence?: Evidence;
  blockers: Blocker[];
  escalations: Escalation[];
}

/** Immutable, append-only record of everything that happened in the demo. */
export interface DomainEvent {
  seq: number;
  id: Id;
  at: ISODateTime;
  actorId: Id;
  type: string;
  transferId?: Id;
  taskId?: Id;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  data?: Record<string, unknown>;
}

export interface DemoState {
  schemaVersion: 1;
  /** Controllable demo clock. All events are stamped with this. */
  now: ISODateTime;
  nextId: number;
  organizations: Organization[];
  practitioners: Practitioner[];
  patients: Patient[];
  documents: SourceDocument[];
  transfers: TransferEpisode[];
  tasks: CareTask[];
  events: DomainEvent[];
}
