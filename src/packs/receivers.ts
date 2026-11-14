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
  /** If set, only a sending professional with one of these roles may confirm the field. */
  confirmRoles?: string[];
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
  /** Pathway pack used for the tracked actions when this profile is chosen. */
  defaultPackId?: string;
  /**
   * Sign-off policy for this receiver. Overrides the transfer kind's default roles. Demonstration
   * policy only — not a statement of universal NHS workforce rules.
   */
  signOffRoles?: string[];
  /**
   * Simulated service capability statements, DISPLAYED to the receiving professional. Never used to
   * block or auto-reject: the receiving professional decides.
   */
  capabilities?: string[];
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

// ---------------------------------------------------------------------------------------------
// Cataract demonstration profiles — Illustrative — pending clinician sign-off.
// Not an authorised NHS minimum dataset. Optional clinical measurements never block sending.
const CATARACT_DISCLAIMER =
  "Synthetic demonstration profile — Illustrative, pending clinician sign-off. Requirements are examples, NOT an authorised NHS minimum dataset, and have not been approved by any provider.";

/**
 * Demonstration role policy (illustrative — pending clinician sign-off): a coordinator may enter or
 * transcribe these values, but only an ophthalmologist may confirm them.
 */
const CLINICAL_CONFIRMERS = ["ophthalmologist"];

const cataractFields: ProfileFieldRule[] = [
  ...identity,
  { key: "sendingService", required: true, prompt: "Which NHS clinical service is sending the patient?" },
  { key: "sendingClinician", required: true, prompt: "Who is the responsible sending professional?" },
  { key: "reasonForTransfer", required: true, prompt: "Why is a transfer to an alternative provider proposed?" },
  {
    key: "treatmentPlan",
    required: true,
    confirmRoles: CLINICAL_CONFIRMERS,
    prompt: "What treatment plan has the ophthalmologist documented?",
    rationale: "The decision to offer surgery is already made by the sending team; the receiver needs the documented plan.",
  },
  {
    key: "laterality",
    required: true,
    confirmRoles: CLINICAL_CONFIRMERS,
    prompt: "Which eye (right or left) is the proposed procedure for?",
    rationale: "Illustrative: laterality must be explicit and clinician-confirmed; it is never inferred from free text.",
  },
  {
    key: "providerTransferAgreement",
    required: true,
    confirmRoles: ["pathway-coordinator", "ophthalmologist"],
    prompt: "Has the patient agreed to the alternative provider — Agreed or Declined? (This is not consent for surgery.)",
    rationale: "Patient agreement to a different provider is recorded separately from clinical consent.",
  },
  { key: "receivingContact", required: true, prompt: "Who is the receiving organisation's contact / owning role?" },
  { key: "nextAction", required: true, prompt: "What is the required next action?" },
  { key: "accountableProfessional", required: true, prompt: "Which named professional is accountable for that next action?" },
  { key: "eyeSequence", required: false, prompt: "Is this the first or second eye?" },
  {
    key: "previousEyeProcedures",
    required: false,
    requiredWhen: { field: "eyeSequence", equals: "second" },
    prompt: "What previous eye procedures has the patient had?",
    rationale: "Conditional (illustrative): required when this is the second eye.",
  },
  { key: "visualAcuity", required: false, prompt: "Visual acuity, both eyes, if available?" },
  { key: "refraction", required: false, prompt: "Refraction, if available?" },
  { key: "intraocularPressure", required: false, prompt: "Intraocular pressure, if available?" },
  { key: "ocularHistory", required: false, prompt: "Ocular history or co-pathology?" },
  { key: "medicalHistory", required: false, prompt: "Relevant medical history?" },
  { key: "medications", required: false, confirmRoles: CLINICAL_CONFIRMERS, prompt: "Current medicines?" },
  { key: "allergies", required: false, confirmRoles: CLINICAL_CONFIRMERS, prompt: "Allergies?" },
  { key: "anticoagulants", required: false, confirmRoles: CLINICAL_CONFIRMERS, prompt: "Anticoagulant history, when clinically relevant?" },
  { key: "alphaBlockers", required: false, confirmRoles: CLINICAL_CONFIRMERS, prompt: "Alpha-blocker history, when clinically relevant?" },
  { key: "anaestheticRequirement", required: false, confirmRoles: CLINICAL_CONFIRMERS, prompt: "Anaesthetic considerations?" },
  { key: "biometry", required: false, prompt: "Biometry / keratometry, if available at this stage?" },
  { key: "accessNeeds", required: false, prompt: "Mobility, access, transport or communication needs?" },
  { key: "investigations", required: false, prompt: "Outstanding investigations or appointments?" },
];

export const independentOphthalmologyProfile: ReceiverProfile = {
  id: "independent-ophthalmology",
  name: "Brookfield Eye Centre — NHS-funded independent cataract provider (synthetic)",
  version: "0.1-demo",
  reviewDate: "2026-11-14",
  serviceType: "Independent-sector ophthalmology (NHS-funded elective cataract surgery)",
  owningRole: "receiving-coordinator",
  orgId: "org-isp",
  transferKinds: ["provider-move"],
  defaultPackId: "cataract-provider-move",
  signOffRoles: CLINICAL_CONFIRMERS, // demonstration policy: the sending ophthalmologist signs off
  capabilities: [
    "Day-case cataract surgery under local or topical anaesthesia (synthetic assumption).",
    "No general anaesthesia facilities on this site (synthetic assumption, subject to clinician confirmation).",
    "Capability statements are shown to the receiving professional; they never auto-reject a transfer.",
  ],
  fields: cataractFields,
  constraints: { allowManualIdentityCheck: true },
  references: ["NICE NG77 — pathway context only; no claim of NICE or RCOphth compliance."],
  disclaimer: CATARACT_DISCLAIMER,
};

export const nhsOphthalmologyProfile: ReceiverProfile = {
  id: "nhs-ophthalmology",
  name: "Westmoor Hospital Ophthalmology — NHS hospital service (synthetic)",
  version: "0.1-demo",
  reviewDate: "2026-11-14",
  serviceType: "NHS hospital ophthalmology",
  owningRole: "ophthalmic-surgeon",
  orgId: "org-westmoor",
  transferKinds: ["provider-move", "referral"],
  defaultPackId: "cataract-provider-move",
  signOffRoles: CLINICAL_CONFIRMERS, // demonstration policy: the sending ophthalmologist signs off
  capabilities: [
    "Hospital ophthalmology including theatre lists with anaesthetic support (synthetic assumption).",
    "Capability statements are shown to the receiving professional; they never auto-reject a transfer.",
  ],
  fields: cataractFields,
  constraints: { allowManualIdentityCheck: true },
  references: ["NICE NG77 — pathway context only; no claim of NICE or RCOphth compliance."],
  disclaimer: CATARACT_DISCLAIMER,
};

export const RECEIVER_PROFILES: Record<string, ReceiverProfile> = {
  [communityCareProfile.id]: communityCareProfile,
  [specialistOutpatientProfile.id]: specialistOutpatientProfile,
  [independentOphthalmologyProfile.id]: independentOphthalmologyProfile,
  [nhsOphthalmologyProfile.id]: nhsOphthalmologyProfile,
};

export function getReceiverProfile(id: string): ReceiverProfile {
  const p = RECEIVER_PROFILES[id];
  if (!p) throw new Error(`Unknown receiver profile: ${id}`);
  return p;
}

export function listReceiverProfiles(kind?: TransferKind, orgIds?: string[]): ReceiverProfile[] {
  return Object.values(RECEIVER_PROFILES).filter(
    (p) => (!kind || p.transferKinds.includes(kind)) && (!orgIds || orgIds.includes(p.orgId)),
  );
}
