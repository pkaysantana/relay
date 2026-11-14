/**
 * Prepared SYNTHETIC source documents. Fictional people, fictional identifiers (999 test range,
 * Ofcom drama phone numbers). No real patient data. Explicitly labelled lines only.
 */
export interface PreparedDocument {
  id: string;
  title: string;
  /** Patient the document is intended for in the demo (the identity check still verifies it). */
  intendedPatientId: string;
  purpose: string;
  text: string;
}

const HEADER = "SYNTHETIC DOCUMENT — FICTIONAL PATIENT — NOT FOR CLINICAL USE";

import { CATARACT_DOCUMENTS } from "./cataractDocuments";

const GENERIC_DOCUMENTS: PreparedDocument[] = [
  {
    id: "doc-1",
    title: "Discharge handover — Synthetic Patient A",
    intendedPatientId: "pat-1",
    purpose: "Complete discharge handover for the community-care profile",
    text: `${HEADER}
Discharge handover — Northgate General Hospital, Ward 7
Patient ID: 999 000 0001
Date of birth: 12/03/1948
Sending clinician: Dr Amara Lane, Ward 7
Reason for transfer: Medically ready for discharge after a 5-day stay; needs support at home.
Care requirements: Check recovery and mobility at home; support with personal care for one week.
Medications: Unchanged from admission list (synthetic list SYN-MED-0001).
Allergies: None known
Contact: Partner, 01632 960001 (synthetic)
Agreed timing: First visit within 2 days of discharge, agreed with patient.
Interpreter needed: No
Access notes: Key safe by front door.
Requested action: Community review of recovery at home.
Receiving service: Riverside Community Nursing`,
  },
  {
    id: "doc-2",
    title: "Referral letter — Synthetic Patient B",
    intendedPatientId: "pat-2",
    purpose: "Complete referral for the specialist outpatient profile",
    text: `${HEADER}
Referral — Elm Street Surgery
Patient ID: 9990000002
DOB: 30/07/1955
Referring clinician: Dr Ruth Hale, GP
Reason for referral: Symptoms not resolved in primary care; specialist opinion requested.
Clinical assessment: Assessed in surgery twice; findings in synthetic note SYN-NOTE-0102.
Relevant investigations: Routine blood tests completed (synthetic results SYN-LAB-0102).
Patient choice: Patient agreed to referral and chose Hillside Specialist Outpatients.
Allergies: Penicillin (rash)
Requested action: Specialist assessment and advice.`,
  },
  {
    id: "doc-3",
    title: "Discharge handover — Synthetic Patient C",
    intendedPatientId: "pat-3",
    purpose: "Complete discharge handover (later becomes the overdue scenario)",
    text: `${HEADER}
Discharge handover — Northgate General Hospital, Ward 7
Patient ID: 999 000 0003
Date of birth: 02/11/1939
Sending clinician: Dr Amara Lane, Ward 7
Care requirements: Review recovery at home; check the care plan is working.
Medications: Unchanged (synthetic list SYN-MED-0003).
Allergies: None known
Contact: Patient directly, 01632 960003 (synthetic)
Agreed timing: First visit within 2 days of discharge.
Interpreter needed: No`,
  },
  {
    id: "doc-4",
    title: "Discharge handover — Synthetic Patient D (ambiguous)",
    intendedPatientId: "pat-4",
    purpose: "Contradictory allergies, unclear timing, interpreter language missing",
    text: `${HEADER}
Discharge handover — Northgate General Hospital, Ward 3
Patient ID: 999 000 0004
Date of birth: 19/01/1961
Sending clinician: Dr Amara Lane, Ward 3
Care requirements: Support with stairs; review recovery at home.
Medications: As per synthetic list SYN-MED-0004.
Allergies: Penicillin
Contact: Daughter, 01632 960004 (synthetic)
Agreed timing: TBC with patient
Interpreter needed: Yes

Nursing section
Allergies: None known`,
  },
  {
    id: "doc-5",
    title: "Discharge handover — Synthetic Patient E (incomplete)",
    intendedPatientId: "pat-5",
    purpose: "Live walkthrough: allergies missing, contact line empty",
    text: `${HEADER}
Discharge handover — Northgate General Hospital, Ward 3
Patient ID: 999 000 0005
Date of birth: 08/05/1972
Sending clinician: Dr Amara Lane, Ward 3
Care requirements: Short-term support at home after a 2-day stay.
Medications: Unchanged (synthetic list SYN-MED-0005).
Contact:
Agreed timing: First visit within 3 days, agreed with patient.
Interpreter needed: No`,
  },
  {
    id: "doc-6",
    title: "Medication list — belongs to Synthetic Patient A",
    intendedPatientId: "pat-1",
    purpose: "Wrong-patient test: attach to Patient E's handover to see the identity block",
    text: `${HEADER}
Medication list
Patient ID: 999 000 0001
DOB: 12/03/1948
Medications: Synthetic list SYN-MED-0001 (printed copy).`,
  },
];

export const PREPARED_DOCUMENTS: PreparedDocument[] = [...GENERIC_DOCUMENTS, ...CATARACT_DOCUMENTS];

export function preparedDocument(id: string): PreparedDocument {
  const d = PREPARED_DOCUMENTS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown prepared document ${id}`);
  return d;
}
