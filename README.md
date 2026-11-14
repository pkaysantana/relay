# Relay (repo: doorstep)

Relay is an illustrative handover-readiness and accountability layer. It is intended to complement existing referral and elective-care systems (such as NHS e-RS, Shared PTL and current mutual-aid workflows), not replace them.

It was built for the National MedTech Hackathon 2026 (Respond track, challenge 6, "Lost Between Services"). All data is synthetic, and the prototype is not for clinical use.

**Working demonstration niche:** NHS-funded cataract surgery. An already-assessed elective patient is transferred from an NHS hospital eye service to an independent-sector provider. The engine, receiver profiles and pathway packs stay niche-agnostic, and a generic demo set is still available.

What Relay does:
- It checks the transfer information against what the chosen receiving service needs: present, confirmed by a named professional, consistent across source documents, and for the right patient.
- It tracks whether the receiving organisation explicitly accepts responsibility, and what happens afterwards (booking, then the clinical actions), with evidence.

What Relay does not do: it does not choose providers, judge clinical suitability, predict capacity, invent appointment slots, calculate tariffs, or make treatment decisions. The sending team keeps responsibility until a named receiving professional accepts.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 65 tests on synthetic scenarios (not real-world evidence)
npm run build
```

All dashboard figures and test results are simulated from synthetic events. They are not measurements of real NHS performance and do not show reduced waiting times or improved outcomes.

Views: `/hub` is the sending service (capture, review, confirm, send). `/receive` is the receiving provider (acknowledge, then accept, reject or ask for clarification). `/dashboard` shows the pipeline and operational measures. Use the header to switch demo set, advance the demo clock or reset.

For the demo walkthrough see [docs/DEMO-CHECKLIST.md](docs/DEMO-CHECKLIST.md). For architecture and rules see [CLAUDE.md](CLAUDE.md).

Clinical content is illustrative and pending clinician sign-off. It is not an authorised NHS minimum dataset. NICE NG77 is cited for pathway context only; the prototype makes no claim of compliance with NICE or RCOphth guidance.
