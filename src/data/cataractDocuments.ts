/**
 * SYNTHETIC cataract transfer documents. Fictional patients, identifiers (999 test range),
 * organisations and phone numbers (Ofcom drama range). Clinical content is illustrative —
 * pending clinician sign-off. No real patient data.
 */
import type { PreparedDocument } from "./documents";

const HEADER = "SYNTHETIC DOCUMENT — FICTIONAL PATIENT — NOT FOR CLINICAL USE";
const SENDER = `Sending service: Northgate Hospital Eye Service, cataract clinic
Sending clinician: Mr Tomas Reyes, consultant ophthalmologist`;
const RECEIVER = `Receiving contact: Brookfield Eye Centre, patient pathway coordinator
Next action: Receiving provider to book the pre-operative assessment
Accountable professional: Priya Shah, elective pathway coordinator (sending team, until acceptance)`;
const REASON =
  "Reason for transfer: Already-assessed elective patient offered treatment at an alternative NHS-funded provider under the existing elective pathway.";

export const CATARACT_DOCUMENTS: PreparedDocument[] = [
  {
    id: "cdoc-A",
    title: "Cataract transfer package — Synthetic Patient F",
    intendedPatientId: "pat-c1",
    purpose: "Scenario A: complete package",
    text: `${HEADER}
Northgate Hospital Eye Service — transfer of care to alternative provider
Patient ID: 999 100 0001
Date of birth: 04/06/1951
${SENDER}
${REASON}
Treatment plan: Cataract surgery (phacoemulsification with lens implant) under local anaesthesia, as documented by the consultant.
Laterality: Right
First or second eye: First
Patient agreement to alternative provider: Yes — patient agreed to consider Brookfield Eye Centre on 06/11/2026 (synthetic record)
${RECEIVER}
Visual acuity: RE 6/18, LE 6/9 (synthetic)
Intraocular pressure: RE 16, LE 15 mmHg (synthetic)
Medications: Synthetic list SYN-MED-C001
Allergies: None known
Anticoagulants: None
Alpha-blockers: None
Anaesthetic considerations: Local anaesthesia documented as suitable by the consultant (synthetic)
Access needs: None recorded`,
  },
  {
    id: "cdoc-B",
    title: "Cataract transfer package — Synthetic Patient G (GA documented)",
    intendedPatientId: "pat-c2",
    purpose: "Scenario B: complete, but documents a general-anaesthesia requirement",
    text: `${HEADER}
Northgate Hospital Eye Service — transfer of care to alternative provider
Patient ID: 999 100 0002
Date of birth: 17/09/1946
${SENDER}
${REASON}
Treatment plan: Cataract surgery (phacoemulsification with lens implant) under general anaesthesia, as documented by the consultant.
Laterality: Left
First or second eye: First
Patient agreement to alternative provider: Yes — patient agreed to consider Brookfield Eye Centre on 05/11/2026 (synthetic record)
${RECEIVER}
Anaesthetic considerations: General anaesthesia required, documented by the consultant (synthetic)
Access needs: Wheelchair user; hospital transport requested (synthetic)
Allergies: None known`,
  },
  {
    id: "cdoc-C",
    title: "Cataract transfer package — Synthetic Patient H",
    intendedPatientId: "pat-c3",
    purpose: "Scenario C: complete package (accepted, then no booking recorded)",
    text: `${HEADER}
Northgate Hospital Eye Service — transfer of care to alternative provider
Patient ID: 999 100 0003
Date of birth: 22/01/1958
${SENDER}
${REASON}
Treatment plan: Cataract surgery (phacoemulsification with lens implant) under topical anaesthesia, as documented by the consultant.
Laterality: Left
First or second eye: Second
Previous eye procedures: Right cataract surgery 2025 (synthetic)
Patient agreement to alternative provider: Yes — patient agreed to consider Brookfield Eye Centre on 07/11/2026 (synthetic record)
${RECEIVER}
Allergies: None known`,
  },
  {
    id: "cdoc-D1",
    title: "Cataract transfer package — Synthetic Patient J",
    intendedPatientId: "pat-c4",
    purpose: "Scenario D (1 of 2): states RIGHT eye",
    text: `${HEADER}
Northgate Hospital Eye Service — transfer of care to alternative provider
Patient ID: 999 100 0004
Date of birth: 30/03/1949
${SENDER}
${REASON}
Treatment plan: Cataract surgery (phacoemulsification with lens implant) under local anaesthesia, as documented by the consultant.
Laterality: Right
Patient agreement to alternative provider: Yes — patient agreed to consider Brookfield Eye Centre on 08/11/2026 (synthetic record)
${RECEIVER}`,
  },
  {
    id: "cdoc-D2",
    title: "Clinic letter — Synthetic Patient J",
    intendedPatientId: "pat-c4",
    purpose: "Scenario D (2 of 2): clinic letter states LEFT eye",
    text: `${HEADER}
Northgate Hospital Eye Service — clinic letter to GP
Patient ID: 999 100 0004
Date of birth: 30/03/1949
Laterality: Left
Visual acuity: RE 6/9, LE 6/24 (synthetic)`,
  },
  {
    id: "cdoc-E",
    title: "Cataract transfer package — Synthetic Patient K (live demo)",
    intendedPatientId: "pat-c5",
    purpose: "Scenario E (live): laterality missing; agreement to the alternative provider not confirmed",
    text: `${HEADER}
Northgate Hospital Eye Service — transfer of care to alternative provider
Patient ID: 999 100 0005
Date of birth: 12/12/1953
${SENDER}
${REASON}
Treatment plan: Right cataract surgery (phacoemulsification with lens implant) under local anaesthesia, as documented by the consultant.
First or second eye: First
Patient agreement to alternative provider: To be confirmed with patient
${RECEIVER}
Visual acuity: RE 6/24, LE 6/12 (synthetic)
Allergies: None known
Access needs: Hearing impairment — prefers written appointment letters (synthetic)`,
  },
];
