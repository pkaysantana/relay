/**
 * Deterministic receiver validation. PURE: no state, no clock, no I/O.
 *
 * It checks the PRESENCE and CONFIRMATION STATE of the information a receiver profile asks for,
 * and whether the patient identifiers agree. It makes no clinical judgement: it never decides
 * urgency, appropriateness, eligibility or whether the transfer should happen.
 *
 *   GREEN  required info present and confirmed by a named professional
 *   AMBER  present but unconfirmed, ambiguous or malformed (blocks only if required)
 *   RED    required info missing, or a blocking contradiction (conflicting source values,
 *          identifier mismatch)
 * Optional fields never block. A field becomes required conditionally only via
 * `requiredWhen: { field, equals }` (field may be the pseudo-field "transferKind").
 *
 * OWNER: core model & state transitions.
 */
import { FIELD_BY_KEY, fieldLabel } from "@/packs/fields";
import type { ReceiverProfile } from "@/packs/receivers";
import type { Handover, HandoverField, Patient, SourceDocument } from "./types";

export type Rag = "green" | "amber" | "red";

export interface FieldValidation {
  key: string;
  label: string;
  required: boolean;
  /** "absent-optional" = optional and not supplied (informational, never blocking). */
  status: Rag | "absent-optional";
  blocking: boolean;
  reasons: string[];
  question?: string;
  /** Which profile rule produced this result, e.g. "community-care@0.1-demo:allergies:required". */
  rule: string;
}

export interface IdentityValidation {
  status: "match" | "mismatch" | "unverified" | "manually-checked";
  blocking: boolean;
  reasons: string[];
}

export interface HandoverValidation {
  profileId: string;
  profileVersion: string;
  fields: FieldValidation[];
  identity: IdentityValidation;
  blocking: boolean;
  blockingReasons: string[];
  questions: string[];
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
export const digitsOnly = (v: string) => v.replace(/\D/g, "");

/** Distinct values the source documents gave for this field. */
export function sourceValues(f: HandoverField): string[] {
  return [...new Set(f.evidence.map((e) => norm(e.value)))];
}

/** Conflicting evidence: an extracted field whose sources disagree. Manual correction resolves it. */
export function hasConflict(f: HandoverField): boolean {
  return f.entryMethod !== "manual" && sourceValues(f).length > 1;
}

/** Demonstration role policy: may a professional with `role` confirm this field under this profile? */
export function canConfirm(profile: ReceiverProfile, key: string, role: string | undefined): boolean {
  const rule = profile.fields.find((r) => r.key === key);
  return !rule?.confirmRoles || (!!role && rule.confirmRoles.includes(role));
}

/**
 * Fields a professional may bulk-confirm: present, unconfirmed, unflagged, consistent, well-formed
 * and permitted for their role. Bulk confirmation is just repeated single confirmations; the engine
 * re-checks every one.
 */
export function bulkConfirmCandidates(h: Handover, profile: ReceiverProfile, role: string | undefined): string[] {
  return Object.values(h.fields)
    .filter(
      (f) =>
        !f.confirmedBy &&
        !!f.value.trim() &&
        !f.ambiguity &&
        !hasConflict(f) &&
        !formatProblem(f.key, f.value) &&
        !(FIELD_BY_KEY[f.key]?.format === "agreement" && norm(f.value) === "declined") &&
        canConfirm(profile, f.key, role),
    )
    .map((f) => f.key);
}

export function formatProblem(key: string, value: string): string | undefined {
  const def = FIELD_BY_KEY[key];
  if (!def || !value.trim()) return undefined;
  if (def.format === "nhs-number" && !/^\d{10}$/.test(digitsOnly(value))) return "Not a 10-digit NHS number";
  if (def.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return "Date must be YYYY-MM-DD";
  if (def.format === "yes-no" && !["yes", "no"].includes(norm(value))) return "Expected yes or no";
  if (def.format === "laterality" && !["right", "left"].includes(norm(value))) return "Expected a single eye: right or left";
  if (def.format === "agreement" && !["agreed", "declined"].includes(norm(value)))
    return "Agreement must be recorded as Agreed or Declined";
  return undefined;
}

function isRequired(profileRule: ReceiverProfile["fields"][number], h: Handover): boolean {
  if (profileRule.required) return true;
  const c = profileRule.requiredWhen;
  if (!c) return false;
  const actual = c.field === "transferKind" ? h.transferKind : h.fields[c.field]?.value ?? "";
  return norm(actual) === norm(c.equals);
}

export function checkIdentity(
  h: Handover,
  profile: ReceiverProfile,
  patient: Patient | undefined,
  documents: SourceDocument[],
): IdentityValidation {
  const reasons: string[] = [];
  if (!patient) return { status: "mismatch", blocking: true, reasons: ["No patient selected for this handover"] };

  const claims: { source: string; kind: "nhs" | "dob"; value: string }[] = [];
  for (const key of ["patientId", "dateOfBirth"]) {
    const f = h.fields[key];
    if (!f?.value.trim()) continue;
    const kind = key === "patientId" ? "nhs" : "dob";
    claims.push({ source: "handover field", kind, value: f.value });
    for (const e of f.evidence) {
      const doc = documents.find((d) => d.id === e.documentId);
      claims.push({ source: `document "${doc?.title ?? e.documentId}"`, kind, value: e.value });
    }
  }

  let mismatch = false;
  for (const c of claims) {
    const expected = c.kind === "nhs" ? patient.nhsNumber : patient.birthDate;
    if (!expected) continue;
    const same = c.kind === "nhs" ? digitsOnly(c.value) === digitsOnly(expected) : c.value.trim() === expected;
    if (!same) {
      mismatch = true;
      reasons.push(
        `${c.source} gives ${c.kind === "nhs" ? "NHS number" : "date of birth"} "${c.value}", but the selected patient record has "${expected}"`,
      );
    }
  }

  // Every attached document must carry at least one identifier, or it cannot be attributed.
  for (const id of h.documentIds) {
    const carries = ["patientId", "dateOfBirth"].some((k) => h.fields[k]?.evidence.some((e) => e.documentId === id));
    if (!carries) {
      const doc = documents.find((d) => d.id === id);
      reasons.push(`Document "${doc?.title ?? id}" carries no patient identifier — cannot confirm it belongs to this patient`);
    }
  }

  if (mismatch) return { status: "mismatch", blocking: true, reasons };

  const nhsMatched =
    !!patient.nhsNumber && claims.some((c) => c.kind === "nhs" && digitsOnly(c.value) === digitsOnly(patient.nhsNumber!));
  const dobMatched = !!patient.birthDate && claims.some((c) => c.kind === "dob" && c.value.trim() === patient.birthDate);
  const unattributedDocs = reasons.length > 0;

  if (nhsMatched && dobMatched && !unattributedDocs)
    return { status: "match", blocking: false, reasons: ["NHS number and date of birth match the selected patient record"] };

  if (!nhsMatched) reasons.push("NHS number not available to compare — match not verified");
  if (!dobMatched) reasons.push("Date of birth not available to compare — match not verified");

  if (h.identityCheck && profile.constraints.allowManualIdentityCheck)
    return { status: "manually-checked", blocking: false, reasons: [...reasons, `Manual identity check recorded: ${h.identityCheck.note}`] };
  return { status: "unverified", blocking: true, reasons };
}

export function validateHandover(
  h: Handover,
  profile: ReceiverProfile,
  patient: Patient | undefined,
  documents: SourceDocument[],
): HandoverValidation {
  const identity = checkIdentity(h, profile, patient, documents);
  const fields: FieldValidation[] = profile.fields.map((r) => {
    const required = isRequired(r, h);
    const rule = `${profile.id}@${profile.version}:${r.key}:${r.required ? "required" : r.requiredWhen ? `required-when ${r.requiredWhen.field}=${r.requiredWhen.equals}` : "optional"}`;
    const base = { key: r.key, label: fieldLabel(r.key), required, rule };
    const f = h.fields[r.key];

    if (!f || !f.value.trim()) {
      return required
        ? { ...base, status: "red" as const, blocking: true, reasons: [`Required by ${profile.name} — missing`], question: r.prompt }
        : { ...base, status: "absent-optional" as const, blocking: false, reasons: ["Optional — not supplied"] };
    }

    if (hasConflict(f)) {
      const vals = sourceValues(f);
      return {
        ...base,
        status: required ? ("red" as const) : ("amber" as const),
        blocking: required,
        reasons: [`Source documents disagree: ${vals.map((v) => `"${v}"`).join(" vs ")}`],
        question: `${r.prompt} The sources disagree (${vals.join(" / ")}) — which is correct?`,
      };
    }

    const isIdentity = !!FIELD_BY_KEY[r.key]?.identity;
    if (isIdentity && identity.status === "mismatch") {
      return {
        ...base,
        status: "red" as const,
        blocking: true,
        reasons: ["Does not match the selected patient — possible wrong-patient information"],
        question: "Check the patient identity: the identifiers do not match the selected patient.",
      };
    }

    const malformed = formatProblem(r.key, f.value);
    if (malformed) {
      return {
        ...base,
        status: "amber" as const,
        blocking: required,
        reasons: [`${malformed} — correct the value`, ...(f.ambiguity ? [`Flagged as ambiguous: ${f.ambiguity}`] : [])],
        question: r.prompt,
      };
    }

    // A recorded refusal is never treated as agreement, even once confirmed. Relay does not pick another provider.
    if (FIELD_BY_KEY[r.key]?.format === "agreement" && norm(f.value) === "declined") {
      return {
        ...base,
        status: "red" as const,
        blocking: required,
        reasons: [
          "Patient declined — this handover must not be sent to this provider",
          f.confirmedBy ? "Refusal confirmed by a named professional" : "Refusal not yet confirmed",
        ],
        question: required ? "The patient declined. The sending team decides the next step; Relay does not choose another provider." : undefined,
      };
    }

    if (!f.confirmedBy) {
      const reasons = [
        f.ambiguity ? `Flagged as ambiguous: ${f.ambiguity}` : "Present but not yet confirmed by a named professional",
        f.entryMethod === "manual" ? "Entered manually (no source document)" : `Extracted (${f.entryMethod})`,
        ...(r.confirmRoles ? [`Must be confirmed by: ${r.confirmRoles.join(" or ")}`] : []),
      ];
      return {
        ...base,
        status: "amber" as const,
        blocking: required,
        reasons,
        question: required ? `${r.prompt} Current value "${f.value}" needs confirmation or correction.` : undefined,
      };
    }

    return {
      ...base,
      status: "green" as const,
      blocking: false,
      reasons: [f.ambiguity ? `Was flagged (${f.ambiguity}); reviewed and confirmed` : "Present and confirmed"],
    };
  });

  const blockingReasons = [
    ...fields.filter((f) => f.blocking).map((f) => `${f.label}: ${f.reasons[0]}`),
    ...(identity.blocking ? [`Patient identity ${identity.status}: ${identity.reasons[0] ?? ""}`] : []),
  ];
  const questions = [
    ...fields.filter((f) => f.question && f.blocking).map((f) => f.question!),
    ...(identity.status === "unverified" ? ["Confirm the patient's identity (identifiers missing in the sources)."] : []),
  ];
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    fields,
    identity,
    blocking: blockingReasons.length > 0,
    blockingReasons,
    questions,
  };
}
