/**
 * Shared catalogue of handover fields. Receiver profiles reference these keys; the
 * deterministic parser uses the aliases to read explicitly labelled lines.
 * Adding a field = add an entry here (configuration, not engine code).
 *
 * OWNER: clinical packs.
 */
export type FieldFormat = "text" | "date" | "nhs-number" | "yes-no";

export interface FieldDefinition {
  key: string;
  label: string;
  /** Labels accepted by the parser, case-insensitive, without the trailing colon. */
  aliases: string[];
  format: FieldFormat;
  /** Identity fields feed the patient-identity check. */
  identity?: "nhs-number" | "birth-date";
  long?: boolean;
}

export const FIELD_CATALOGUE: FieldDefinition[] = [
  { key: "patientId", label: "Patient ID (NHS number)", aliases: ["patient id", "nhs number", "nhs no"], format: "nhs-number", identity: "nhs-number" },
  { key: "dateOfBirth", label: "Date of birth", aliases: ["date of birth", "dob"], format: "date", identity: "birth-date" },
  { key: "reasonForTransfer", label: "Reason for transfer / referral", aliases: ["reason for transfer", "reason for referral"], format: "text", long: true },
  { key: "sendingClinician", label: "Responsible sending clinician", aliases: ["sending clinician", "referring clinician", "responsible clinician"], format: "text" },
  { key: "requestedAction", label: "Requested action", aliases: ["requested action", "action requested"], format: "text", long: true },
  { key: "receivingService", label: "Receiving service (as stated by sender)", aliases: ["receiving service"], format: "text" },
  { key: "careRequirements", label: "Care requirements", aliases: ["care requirements", "care needs"], format: "text", long: true },
  { key: "medications", label: "Relevant medications", aliases: ["medications", "current medications", "medicines"], format: "text", long: true },
  { key: "allergies", label: "Allergies", aliases: ["allergies", "allergy status"], format: "text" },
  { key: "contactArrangement", label: "Required contact", aliases: ["contact", "required contact", "contact arrangement"], format: "text" },
  { key: "agreedTiming", label: "Agreed timing", aliases: ["agreed timing", "timing"], format: "text" },
  { key: "interpreterNeeded", label: "Interpreter needed", aliases: ["interpreter needed"], format: "yes-no" },
  { key: "interpreterLanguage", label: "Interpreter language", aliases: ["interpreter language"], format: "text" },
  { key: "clinicalAssessment", label: "Existing clinical assessment", aliases: ["clinical assessment", "assessment"], format: "text", long: true },
  { key: "investigations", label: "Relevant investigations", aliases: ["relevant investigations", "investigations"], format: "text", long: true },
  { key: "patientChoice", label: "Patient consent / choice recorded", aliases: ["patient consent", "patient choice", "consent"], format: "text" },
  { key: "previousProvider", label: "Current treating provider", aliases: ["current provider", "previous provider", "transferring provider"], format: "text" },
  { key: "accessNotes", label: "Access / visit notes", aliases: ["access notes", "access"], format: "text", long: true },
];

export const FIELD_BY_KEY: Record<string, FieldDefinition> = Object.fromEntries(
  FIELD_CATALOGUE.map((f) => [f.key, f]),
);

export function fieldLabel(key: string): string {
  return FIELD_BY_KEY[key]?.label ?? key;
}
