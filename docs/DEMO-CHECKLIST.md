# Demo click path: cataract handover (NHS eye service → independent provider)

> **UNVERIFIED IN A BROWSER.** Nobody has clicked through this yet. Claude's browser tool (Chrome extension) was not connected, so the steps below were traced from the UI source code. The same command sequence runs in automated tests (`tests/cataract.test.ts` → "E end-to-end"). Before the pitch, one person should click through once and tick each step.

Everything shown is synthetic. Clinical requirements are illustrative and pending clinician sign-off. Dashboard figures are simulated.

## Setup
1. `npm run dev`, then open http://localhost:3000/hub.
2. In the header, check that **Demo:** shows "Cataract: NHS eye service → independent provider". Click **Reset demo**, then **Confirm reset**.
   → The demo clock reads **Sat 14 Nov, 09:30**. "Outgoing transfers (sender view)" lists A, B, C and D.

## Scenario E: live demo (sending side, `/hub`)
3. Click **+ Capture a new handover**.
   → Pre-filled: "1. Source documents (synthetic)" has *Cataract transfer package — Synthetic Patient K (live demo)* ticked. 2. Patient = *Synthetic Patient K · NHS 999 100 0005*. 3. Transfer kind = *Treatment transfer between providers*. 4. Receiving-service profile = *Brookfield Eye Centre — NHS-funded independent cataract provider (synthetic)…*. 5. Responsible sending professional = *Mr Tomas Reyes (consultant ophthalmologist) — ophthalmologist*. 6. Captured by = *Priya Shah (elective pathway coordinator) — pathway-coordinator*.
   (The sending service is implied by the responsible professional: Northgate Hospital Eye Service.)
4. Click **Extract and create draft**.
   → The new transfer opens with status **"Draft — awaiting sender confirmation"**. The panel heading reads "Treatment transfer → Brookfield Eye Centre…", with the capability bullets underneath ("No general anaesthesia facilities on this site (synthetic assumption…)").
   → **Patient identity: match**.
   → Row **Eye (laterality) for the proposed procedure**: **✕ RED**, "Required by … — missing", value *Missing*. The treatment-plan text begins "Right cataract surgery…", but Relay does **not** infer the eye from it.
   → Row **Patient agreement to the alternative provider (not surgical consent)**: **! AMBER**, "Agreement must be recorded as Agreed or Declined — correct the value" and "Flagged as ambiguous: not an explicit agreement ("To be confirmed with patient")", with the quote from the source line.
   → The "Questions to resolve before sending" box lists "Which eye (right or left) is the proposed procedure for?" and the agreement question. "Sign off the handover" says **"Awaiting sender confirmation — cannot be sent yet."**
5. **Acting as** → choose **Priya Shah (elective pathway coordinator) — pathway-coordinator**. (After capture it defaults to the responsible professional, Mr Reyes.)
6. On the agreement row, click **Correct**. The editor is a picker with three options: *Not yet confirmed (clear)*, *Agreed*, *Declined*. Choose **Agreed** and click **Save & confirm**.
   → **✓ GREEN**, value "agreed". Confirmation column: "✓ Priya Shah (elective pathway coordinator) (pathway-coordinator)". Evidence column: "Entered manually by Priya Shah … — no source document".
7. On the laterality row, click **Add**. Type `right` and click **Save & confirm**.
   → The value is saved, but a red error appears: **"Eye (laterality) for the proposed procedure must be confirmed by: ophthalmologist (you are pathway-coordinator)"**. The row stays **! AMBER** ("Must be confirmed by: ophthalmologist"). *The coordinator cannot confirm a restricted clinical detail.*
8. **Acting as** → **Mr Tomas Reyes (consultant ophthalmologist) — ophthalmologist**.
9. On the laterality row, click **Confirm** → **✓ GREEN**, confirmed by Mr Tomas Reyes (ophthalmologist).
10. Click **I have reviewed these against the source — confirm N unflagged values as Mr Tomas Reyes…**. (The button lists the fields it covers, including the treatment plan and allergies. It skips anything flagged, conflicting, declined or needing another role. The engine re-checks the role on every field.)
    → Every **Required** row is **✓ GREEN**. The summary reads "Required: 11 green 0 amber 0 red". "Sign off the handover" says **"All receiver-required information is present and confirmed. Ready for sign-off."**
11. Click **Sign off handover**. (The sign-off box says "Allowed sign-off roles for this treatment transfer between providers (demonstration policy): ophthalmologist". Signing off as Priya is refused by the engine.)
    → Status **"Information confirmed by sender"**. "2. Generate the structured handover" appears.
12. Click **Generate handover**.
    → "3. Confirm deadlines and send": three actions with placeholder deadlines (the booking review shows "Synthetic administrative review deadline (4 days) — NOT a national NHS standard…"). Receiving organisation is pre-selected as **Brookfield Eye Centre (independent sector, NHS-funded)**.
13. Tick **"I, Mr Tomas Reyes (consultant ophthalmologist), confirm these deadlines are clinically appropriate for this patient."** Click **Send transfer**.
    → Status **"Sent — not acknowledged"**. "Required actions" lists the three tasks as **"Requested — awaiting receipt"**.
14. (Optional, shows elapsed time) Click **+6h** in the header.

## Safety checks for Keshav (UNVERIFIED in a browser; the same rules are covered by `tests/safety.test.ts`)
S1. **Declined blocks.** Reset, then capture as in steps 3–4. On the agreement row: **Correct** → **Declined** → **Save & confirm** (acting as Priya).
    → **✕ RED**: "Patient declined — this handover must not be sent to this provider" and "Refusal confirmed by a named professional". The questions box says "The patient declined. The sending team decides the next step; Relay does not choose another provider." As Mr Reyes, **Sign off handover** shows the error "Cannot sign off: Patient agreement to the alternative provider (not surgical consent): Patient declined…".
S2. **Coordinator bulk confirm excludes clinical fields.** After a fresh capture, act as Priya. The bulk button's list ("Skips anything flagged…: …") does **not** include Ophthalmologist's documented treatment plan, Allergies or other clinical fields. Clicking **Confirm** on *Ophthalmologist's documented treatment plan* or *Allergies* as Priya shows "… must be confirmed by: ophthalmologist (you are pathway-coordinator)".
S3. **Sign-off role.** With every required row GREEN, act as Priya and click **Sign off handover** → error "…needs one of these roles: ophthalmologist (you are pathway-coordinator)". (The GP case is covered by an automated test only: the cataract demo has no GP at the eye service.)

## Scenario E: receiving side (`/receive`)
15. Click **Receiving team**. Receiving organisation = **Brookfield Eye Centre (independent sector, NHS-funded)**; Acting as = **Dr Helen Ward (ophthalmic surgeon)** (both are the defaults).
16. In **Inbox**, click **Synthetic Patient K SYN-C005**.
    → "Treatment transfer between providers · From Mr Tomas Reyes…"; "Signed off by **Mr Tomas Reyes (consultant ophthalmologist)** (ophthalmologist)"; the same handover panel with source quotes (read-only).
17. Click **Acknowledge receipt** → status **"Acknowledged — responsibility NOT yet accepted"**.
18. Click **Accept responsibility** without choosing anyone.
    → Error **"Cannot accept without naming the responsible professional"**.
19. Set **Named responsible professional (required)** to **Dr Helen Ward (ophthalmic surgeon)**, then click **Accept responsibility**.
    → Status **"Handover accepted by named professional"**. "Decisions on responsibility" reads: *accepted by Dr Helen Ward (ophthalmic surgeon) (ophthalmic-surgeon), Sat 14 Nov, …*. The simulated next step reads "(mock — no PTL/DMAS integration)". All three actions read **"Accepted — not started"**; nothing is marked done.

## Scenario E: dashboard (`/dashboard`)
20. Click **Dashboard**.
    → "Handover pipeline (simulated, from the event history)": **Accepted 3** (was 2). **Accepted, awaiting appointment** now also lists *Synthetic Patient K (SYN-C005)* with its due time and "escalation contact Priya Shah (elective pathway coordinator)".
    → **Missing required fields identified at capture**: Brookfield profile · *Eye (laterality) for the proposed procedure* · 1.
    → **Handover submission → receiving-team acceptance**: 3 accepted handovers.

## Other seeded scenarios (on `/hub` unless stated)
21. **A — accepted, booking recorded (surgery not done)**: the booking task is **"Completed — evidence recorded"** ("…Booking only — no treatment has taken place."). The pre-op task reads **"Accepted · scheduled (not done)"**. The surgery-outcome task reads **"Accepted — not started"**.
22. **B — rejected: anaesthetic capability mismatch**: every required row is GREEN. Status **"Rejected — unresolved"**, with Dr Helen Ward's reason (general anaesthesia not available). The box "Unresolved: the receiving service rejected this transfer" says responsibility stays with the sending team and that Relay does not choose another provider. Optional: **Redirect to (receiver profile)** = Westmoor, then **Redirect transfer**.
23. **C — accepted, no appointment by review deadline**: on `/dashboard`, "Accepted, awaiting appointment" shows Synthetic Patient H in red: **"⚠ review deadline passed (Fri 13 Nov, 10:00) — escalate to Priya Shah…"**. "Overdue tasks by responsible team" lists Brookfield as about 24 hours overdue.
24. **D — sources disagree on laterality** (opens by default): the laterality row is **✕ RED**, "Source documents disagree: "right" vs "left"", with two quotes. Clicking **Confirm** gives the error "Sources disagree: enter the correct value before confirming". **Sign off handover** is refused.

## Refresh and reset
25. Press **F5** on any page. → The state persists (stored in the browser). On `/hub` the default selection returns to D, and Patient K is still in the list.
26. Click **Reset demo**, then **Confirm reset**. → Only A–D remain, the clock reads Sat 14 Nov, 09:30, and Patient K is gone. Repeat from step 3 for a second run.

## Generic demo (unchanged)
Choose **Demo:** "Generic handovers (discharge / referral)" to load the Prompt 2 scenarios. Switching demo set resets it.
