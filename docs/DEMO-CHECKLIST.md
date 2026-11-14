# Manual click-through checklist

**Status: NOT browser-verified by Claude.** The Chrome extension was not connected. The same command sequences are covered by automated engine/store tests (`tests/cataract.test.ts`, `tests/handover.test.ts`). The server-rendered HTML of `/hub`, `/receive` and `/dashboard` was checked with curl. Clicking through in a real browser is still outstanding.

Setup: run `npm run dev` and open http://localhost:3000/hub. In the header, set **Demo** to "Cataract: NHS eye service → independent provider". Selecting it resets that demo.

All data is synthetic. Clinical content is illustrative and pending clinician sign-off.

---

## Cataract demo (NHS hospital eye service → NHS-funded independent provider)

### D — Contradictory sources (opens by default on /hub)
1. In the left list, select **D — sources disagree on laterality**.
   - Expected: the status reads "Draft — awaiting sender confirmation". The **Eye (laterality)** row is **✕ RED**: "Source documents disagree: "right" vs "left"". Its evidence shows two quotes, one from the transfer package and one from the clinic letter.
   - Expected: the question box reads "Which eye (right or left)…? The sources disagree (right / left) — which is correct?"
2. Click **Confirm** on the laterality row. Expected error: "Sources disagree: enter the correct value before confirming".
3. Click **Sign off handover**. Expected error: "Cannot sign off: …".
4. (Optional resolution) With **Acting as** set to Mr Tomas Reyes (ophthalmologist): **Correct** → type `right` → **Save & confirm**. The row turns GREEN and the evidence reads "Entered manually by Mr Tomas Reyes — no source document". **Sign off handover** then succeeds.

### E — Live demo (the primary 3-minute pitch flow)
1. Click **+ Capture a new handover**. Expected defaults: *Cataract transfer package — Synthetic Patient K (live demo)* ticked; patient Synthetic Patient K; kind "Treatment transfer between providers"; profile "Brookfield Eye Centre…"; responsible sender Mr Tomas Reyes; captured by Priya Shah. Click **Extract and create draft**.
   - Expected: the new transfer is selected. Patient identity shows **match**. **Eye (laterality)** is **✕ RED** (missing), even though the treatment plan text starts with "Right…" — Relay never infers it. **Patient agreement to the alternative provider** is **! AMBER**: "Flagged as ambiguous: contains "To be confirmed"".
   - Expected: the capability statements are listed under the profile ("No general anaesthesia facilities on this site…").
2. **Acting as** = Priya Shah (pathway-coordinator). On the agreement row: **Correct** → `Yes — patient agreed by phone on 14/11/2026 to consider Brookfield Eye Centre (synthetic record)` → **Save & confirm**.
   - Expected: GREEN, "✓ Priya Shah (pathway-coordinator)", evidence "Entered manually by Priya Shah — no source document".
3. Still as Priya: laterality **Add** → `right` → **Save & confirm**.
   - Expected: the value is saved, but confirming shows the error "… must be confirmed by: ophthalmologist (you are pathway-coordinator)". The row stays AMBER.
4. Switch **Acting as** to Mr Tomas Reyes (ophthalmologist). Click **Confirm** on laterality, then the bulk button "I have reviewed these against the source — confirm N unflagged values as Mr Tomas Reyes…".
   - Expected: every required row is GREEN. The sign-off box says "Ready for sign-off".
5. **Sign off handover** → **Generate handover** → step 3: Brookfield is pre-selected. Tick the deadline confirmation → **Send transfer**.
   - Expected: status "Sent — not acknowledged". The tasks are listed, including "Record booking of the first appointment… (booking is not treatment)".
6. Go to `/receive`. The organisation defaults to Brookfield Eye Centre; acting as Dr Helen Ward. Select **Synthetic Patient K**.
   - Expected: transfer kind, "Signed off by Mr Tomas Reyes (ophthalmologist)", the handover panel with evidence, and the history.
7. Click **Acknowledge receipt**. Expected status: "Acknowledged — responsibility NOT yet accepted".
8. Click **Accept responsibility** with no professional chosen. Expected error: "Cannot accept without naming the responsible professional". Choose Dr Helen Ward → **Accept responsibility**.
   - Expected: status "Responsibility accepted". The decision list reads "accepted by Dr Helen Ward (ophthalmic-surgeon), date". All tasks read "Accepted — not started". The simulated next-step text is shown, marked as a mock.
9. Go to `/dashboard`. Expected: **Accepted** went from 2 to 3. **Accepted, awaiting appointment** now includes Patient K, "due … · escalation contact Priya Shah". After the capture, "Missing required fields identified at capture" lists Eye (laterality) under the Brookfield profile.

### A — Successful transfer, booking ≠ surgery
- `/hub` → **A — accepted, booking recorded**. Expected: all required rows GREEN. The booking task is **Completed — evidence recorded** ("…Booking only — no treatment has taken place"). The pre-op task reads "Accepted · scheduled (not done)". The surgery-outcome task reads **Accepted — not started**.
- `/dashboard` → "Completed downstream actions with supporting evidence" lists only the booking.

### B — Capability mismatch (rejected)
- `/hub` → **B — rejected: anaesthetic capability mismatch**. Expected: all required rows GREEN (the information was complete). The status reads "Rejected — unresolved", with Dr Helen Ward's reason about general anaesthesia. The "Unresolved" box says Relay does not choose another provider.
- (Optional) Redirect to (receiver profile) = *Westmoor Hospital Ophthalmology* → **Redirect transfer** → enter a note. Expected: status "Sent — not acknowledged", receiving organisation Westmoor, and no acceptance.
- `/receive` → organisation Brookfield → B shows a decision list with "rejected by Dr Helen Ward…".

### C — Accepted, no appointment by the review deadline
- `/dashboard` → **Accepted, awaiting appointment** shows Synthetic Patient H in red: "⚠ review deadline passed (Fri 13 Nov, 10:00) — escalate to Priya Shah". **Overdue tasks by responsible team** lists Brookfield, about 24 hours overdue, with the original responsibility (Mr Tomas Reyes).
- `/hub` → C → the booking task shows **Escalate** (sender side). Escalating records the event without changing the owner or status.

### Reset
- Click **Reset demo** → **Confirm reset**. Expected: only cataract scenarios A–D remain, and the demo clock reads Sat 14 Nov, 09:30.

---

## Generic demo (Prompt 2 scenarios, unchanged)
Switch **Demo** to "Generic handovers". Expected: transfers A–D (community / outpatient) as before. The previous checklist steps still apply: capture doc-5 (missing allergies), and doc-5 + doc-6 for the wrong-patient check.
