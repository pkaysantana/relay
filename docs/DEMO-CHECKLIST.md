# Manual click-through checklist (Prompt 2 handover flow)

Status: **not browser-verified by Claude.** The engine/store integration test (`tests/handover.test.ts`) covers this same command sequence. Tick each step in a real browser.

Setup: run `npm run dev` and open http://localhost:3000/hub. Click **Reset demo**, then **Confirm reset**.

## 1. Seeded scenarios render
- [ ] `/hub` opens on **D — ambiguous / contradictory**. The status reads "Draft — awaiting sender confirmation".
- [ ] Allergies shows **✕ RED**, "Source documents disagree: penicillin vs none known", with two quotes from the document.
- [ ] Agreed timing shows **! AMBER**, "Flagged as ambiguous: contains TBC".
- [ ] Interpreter language shows **✕ RED**, marked "Required (conditional)".
- [ ] The questions box lists at least three questions. The sign-off box says "cannot be sent yet". Clicking **Sign off handover** shows an error.
- [ ] Clicking **Confirm** on Allergies shows "Sources disagree: enter the correct value before confirming".

## 2. Capture → missing → correct → sign off → send (P2-B)
- [ ] Click **+ Capture a new handover**. Leave the defaults: doc-5, Synthetic Patient E, Discharge, Community-care, Dr Amara Lane. Click **Extract and create draft**.
- [ ] The new draft is selected. Identity shows **match**. Allergies and Required contact are **RED**. The other required fields are **AMBER** (not confirmed). Each extracted field shows a verbatim quote.
- [ ] Allergies → **Add** → type "None known" → **Save & confirm**. It turns GREEN, and the evidence column reads "Entered manually by Dr Amara Lane — no source document".
- [ ] Required contact → **Add** → enter a value → **Save & confirm**.
- [ ] Click **Confirm** on every remaining AMBER required field. Optional fields can stay grey.
- [ ] **Sign off handover** succeeds. "2. Generate the structured handover" appears → click **Generate handover**.
- [ ] Step 3: Riverside Community Nursing is pre-selected. Tick the deadline confirmation → **Send transfer**. The status reads "Sent — not acknowledged".

## 3. Wrong patient
- [ ] Capture again with **doc-5 and doc-6** ticked for Patient E. Identity shows **mismatch** ("Medication list … 999 000 0001"), and the NHS number and DOB rows are RED. **Record manual identity check** is not offered.

## 4. Receive: accept or reject
- [ ] Go to `/receive` (Riverside Community Nursing). Select the new transfer. You should see the transfer kind, "Signed off by Dr Amara Lane (discharging-clinician)", the handover panel and the history.
- [ ] Click **Acknowledge receipt**. The status reads "Acknowledged — responsibility NOT yet accepted".
- [ ] **Accept responsibility** with no professional chosen gives an error. Choose Jo Mensah → accept. The status reads "Responsibility accepted", the tasks show "Accepted — not started", and the simulated next step appears, marked as a mock.
- [ ] (Alternative) **Reject transfer** with a reason. In `/hub` the transfer shows "Rejected — unresolved", and the reason and original sender stay visible.
- [ ] Switch the organisation to **Hillside Specialist Outpatients** and select **B**. It shows the referral, the "does not provide the requested assessment" reason, and Dr Ruth Hale as sender.

## 5. Dashboard and reset
- [ ] `/dashboard` shows "Missing required fields identified at capture". After step 2 it includes Allergies and Required contact under Community-care.
- [ ] "Handover submission → receiving-team acceptance" changes after step 4.
- [ ] **Reset demo** brings back scenarios A–D only.
