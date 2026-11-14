# Relay pitch brief (one page)

**Facts we may state (and nothing beyond them):**
- **F1.** HSSIB (March 2022) documented incomplete records, repeated pre-operative assessments and conflicting records between NHS and independent hospitals. This was *not* cataract-specific.
- **F2.** England performed 649,886 NHS-funded cataract operations in 2023/24, about 56.8% of them in the independent sector.
- **F3.** Shared PTL already tracks cross-trust transfers.
- **F4.** The rate of information failures in cataract transfers is unknown.

Everything else below is marked **[H]**, meaning hypothesis.

## Problem (30 s)
"Most NHS-funded cataract operations now cross an organisational boundary: about 57% of roughly 650,000 operations in 2023/24 were done in the independent sector [F2]. When surgical patients move between NHS and independent hospitals, HSSIB found incomplete records, conflicting information and repeated pre-operative assessments [F1]. That investigation wasn't about cataracts, and nobody knows how often this happens in cataract transfers [F4]. Our hypothesis is that some of it starts with the handover itself: something missing, unclear or unconfirmed, and no named owner after sending [H]."

## Solution (30 s)
"Relay is a receiver-specific handover-readiness and accountability layer. It checks a handover against what the chosen receiving service says it needs. It links every value to its source document, or marks it as entered by hand. It needs a named, authorised professional to confirm the values and sign off. Then it records who accepted the handover. It doesn't diagnose, triage, choose providers or predict capacity. Clinicians decide; Relay makes the handover explicit."

## Live demo narration (Scenario E; steps = `docs/DEMO-CHECKLIST.md`)
- **Steps 3–4:** "Priya, an elective pathway coordinator, loads a synthetic transfer package for the independent provider. Relay checks it against Brookfield's requirements. The operative eye is missing. The plan text says 'Right', but Relay won't guess. The patient's agreement to the move says 'To be confirmed'. Sending is blocked before anything leaves the hospital."
- **Steps 5–7:** "Priya records the patient's agreement. That's a separate thing from surgical consent. She can't confirm the operative eye: that needs an ophthalmologist."
- **Steps 8–13:** "Mr Reyes confirms the eye and reviews the rest, every confirmation under his name. He signs off and sends."
- **Steps 15–19:** "At Brookfield, acknowledging receipt isn't acceptance. Accepting needs a named professional: Dr Ward. Booking, pre-op and surgery stay separate, open actions."
- **Step 20:** "The dashboard updates from the event history. One case is accepted but has no booking past its synthetic review deadline, and it shows who to escalate to. All of these figures are simulated."

## One-line answers
- **e-RS?** Relay is not a referral system and would sit alongside e-RS. Whether e-RS already covers receiver-specific evidence checks and named acceptance is something we have to test with users [H].
- **Shared PTL?** Shared PTL already tracks cross-trust transfers [F3]. We would complement it at the handover-content level, not replace the tracking [H].
- **Why cataract?** It is very high volume, and most of it crosses into the independent sector [F2]. That makes it a clear test bed. The engine itself isn't cataract-specific.
- **Why would a provider accept?** Complete, confirmed information at the point of acceptance could mean fewer queries and repeated assessments [H; the repeat problem is documented generally in F1].
- **Who pays?** Not established. Candidates are the sending trust, a provider network or an ICB, depending on contracting [H]. We have no buyer agreement.
- **Who is responsible after a rejection?** In Relay the sending team stays visibly responsible, and redirecting needs an explicit human choice of service. Real responsibility follows the local pathway and contract.
- **What proves benefit?** Nothing yet. All of our results are synthetic, and the real failure rate is unknown [F4]. Next steps: clinician-approved requirements, then shadow-mode testing against the current process, with governance and clinical-safety assessment first [H].
