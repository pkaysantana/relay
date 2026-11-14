/**
 * Receiver-profile registry: what a receiving service needs to see before it can consider a
 * handover. Adding a receiver = register a profile here. The validation engine is unchanged.
 *
 * BOTH PROFILES ARE SYNTHETIC DEMONSTRATION PROFILES. Their requirements have NOT been
 * reviewed or approved by any NHS receiving organisation.
 *
 * OWNER: clinical packs.
 */
import type { TransferKind } from "@/core/types";

export interface ProfileFieldRule {
  key: string; // FIELD_CATALOGUE key
  required: boolean;
  /**
   * Conditional requirement: the field becomes required when field `field` has value `equals`
   * (case-insensitive, trimmed). `field` may also be the pseudo-field "transferKind".
   * Only this one form of condition is supported.
   */
  requiredWhen?: { field: string; equals: string };
  /** Question shown to the sender when the field is missing or unconfirmed. */
  prompt: string;
  rationale?: string;
}

export interface ReceiverProfile {
  id: string;
  name: string;
  version: string;
  reviewDate: string;
  serviceType: string;
  /** Role the work is addressed to. A role is a destination, not an accepting professional. */
  owningRole: string;
  /** Simulated receiving organisation in the demo. */
  orgId: string;
  transferKinds: TransferKind[];
  fields: ProfileFieldRule[];
  constraints: {
    /** If identifiers are absent, a named professional may record a manual identity check. */
    allowManualIdentityCheck: boolean;
  };
  references: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Synthetic demonstration profile. Requirements are illustrative and have NOT been approved by any NHS receiving organisation.";

const identity = [
  { key: "patientId", required: true, prompt: "What is the patient's NHS number?", rationale: "Patient identification before any work is accepted." },
  { key: "dateOfBirth", required: true, prompt: "What is the patient's date of birth?", rationale: "Second identifier for matching." },
];

export const communityCareProfile: ReceiverProfile = {
  id: "community-care",
  name: "Community-care receiving team",
  version: "0.1-demo",
  reviewDate: "2026-11-14",
  serviceType: "Community care",
  owningRole: "receiving-clinician",
  orgId: "org-community",
  transferKinds: ["discharge", "provider-move"],
  fields: [
    ...identity,
    { key: "sendingClinician", required: true, prompt: "Who is the responsible sending clinician?", rationale: "Named clinical responsibility until acceptance." },
    { key: "careRequirements", required: true, prompt: "What care does the patient need from the community team?" },
    { key: "medications", required: true, prompt: "Which medications are relevant for the receiving team?", rationale: "Illustrative only; no medication checking is performed." },
    { key: "allergies", required: true, prompt: "What is the patient's allergy status (including 'none known')?" },
    { key: "contactArrangement", required: true, prompt: "How should the receiving team contact the patient or carer?" },
    { key: "agreedTiming", required: true, prompt: "What timing was agreed with the patient for the first contact?" },
    { key: "interpreterNeeded", required: false, prompt: "Does the patient need an interpreter?" },
    {
      key: "interpreterLanguage",
      required: false,
      requiredWhen: { field: "interpreterNeeded", equals: "yes" },
      prompt: "Which language should the interpreter speak?",
      rationale: "Conditional: required only when an interpreter is needed.",
    },
    { key: "accessNotes", required: false, prompt: "Any access notes for home visits?" },
    { key: "requestedAction", required: false, prompt: "Any specific action requested?" },
  ],
  constraints: { allowManualIdentityCheck: true },
  references: ["Illustrative field list for demonstration; to be replaced by receiver-approved requirements."],
  disclaimer: DISCLAIMER,
};

export const specialistOutpatientProfile: ReceiverProfile = {
  id: "specialist-outpatient",
  name: "Specialist outpatient / elective provider",
  version: "0.1-demo",
  reviewDate: "2026-11-14",
  serviceType: "Specialist outpatient / elective",
  owningRole: "specialist-clinician",
  orgId: "org-outpatient",
  transferKinds: ["referral", "provider-move"],
  fields: [
    ...identity,
    { key: "reasonForTransfer", required: true, prompt: "What is the reason for the referral or treatment transfer?" },
    { key: "clinicalAssessment", required: true, prompt: "What clinical assessment has already been made?" },
    { key: "investigations", required: true, prompt: "Which relevant investigations have been done (or 'none')?" },
    { key: "sendingClinician", required: true, prompt: "Who is the referring clinician?" },
    { key: "patientChoice", required: true, prompt: "Has the patient's consent / choice been recorded?" },
    {
      key: "previousProvider",
      required: false,
      requiredWhen: { field: "transferKind", equals: "provider-move" },
      prompt: "Which provider is currently treating the patient?",
      rationale: "Conditional: required only for a move between providers.",
    },
    { key: "allergies", required: false, prompt: "Allergy status, if known?" },
    { key: "requestedAction", required: false, prompt: "What is the sender asking this service to do?" },
  ],
  constraints: { allowManualIdentityCheck: true },
  references: ["Illustrative field list for demonstration; to be replaced by receiver-approved requirements."],
  disclaimer: DISCLAIMER,
};

export const RECEIVER_PROFILES: Record<string, ReceiverProfile> = {
  [communityCareProfile.id]: communityCareProfile,
  [specialistOutpatientProfile.id]: specialistOutpatientProfile,
};

export function getReceiverProfile(id: string): ReceiverProfile {
  const p = RECEIVER_PROFILES[id];
  if (!p) throw new Error(`Unknown receiver profile: ${id}`);
  return p;
}

export function listReceiverProfiles(kind?: TransferKind): ReceiverProfile[] {
  return Object.values(RECEIVER_PROFILES).filter((p) => !kind || p.transferKinds.includes(kind));
}
