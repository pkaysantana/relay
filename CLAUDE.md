# Doorstep — CLAUDE.md

National MedTech Hackathon 2026 · Respond track · Challenge 6 "Lost Between Services". Internal deadline 15:45 UK, 14 Nov 2026.

## Goal
Make transfers of care between services **explicit, traceable and measurable**. Discharge, referral sent, acknowledged, scheduled and done are *different events*. The system must never mistake initiation, acknowledgement or scheduling for verified completion.

Positioning: in-hospital discharge tasks are someone else's problem (e.g. OPTICA). Doorstep owns the actions *after* transfer, across organisations. Don't build in-hospital tracking.

**The clinical niche is NOT decided** (heart failure, COPD and others are candidates). Keep every disease-specific assumption in a pathway pack.

## Hard rules
- Synthetic data only. No real patient-identifiable information, ever.
- Works fully offline: no API key, no network, no external integrations, no database (localStorage only). No `next/font/google`.
- No disease prediction, medication-safety algorithms, urgency/risk scoring or predictive analytics.
- Clinical decisions and deadlines come from a human. Pack timings are placeholders that a clinician confirms (`sendTransfer` records `dueConfirmedBy`).
- Never fabricate appointments, decisions or completion evidence. Scheduling is a human-entered date and is not completion.
- Do not claim FHIR conformance, or that any NHS system can consume the export.
- Dashboard numbers are demonstration metrics from synthetic events, not NHS impact estimates.

## Architecture
One Next.js 15 App Router app, client-side only. UI → `dispatch(Command)` → pure `engine.apply(state, cmd)` → new state + appended events → localStorage.

| Layer | Path | Owner |
|---|---|---|
| Domain types (not FHIR) | `src/core/types.ts` | Core |
| Engine: commands, transition table, invariants | `src/core/engine.ts` | Core |
| Derived facts (overdue, needs-action, labels) | `src/core/selectors.ts` | Core |
| Pathway packs (tasks/timings/quality) | `src/packs/{types,general,index}.ts` | Clinical packs |
| Receiver profiles, field catalogue, transfer kinds | `src/packs/{receivers,fields,transferKinds}.ts` | Clinical packs |
| Receiver validation (pure: GREEN/AMBER/RED + identity) | `src/core/validation.ts` | Core |
| Deterministic labelled parser | `src/extraction/labelledParser.ts` | Integrations |
| Synthetic source documents | `src/data/documents.ts` | Demo lead |
| Metrics | `src/metrics/dashboard.ts` | Evaluation |
| FHIR R4-shaped export (one-way) | `src/fhir/toFhir.ts` | Core / integrations |
| Deterministic scenarios A/B/C/D | `src/scenarios/seed.ts` | Core (+ demo lead) |
| Store (localStorage, reset) | `src/state/store.ts` | UI |
| Views | `src/app/{hub,receive,dashboard}/page.tsx`, `src/components/*` | UI |
| Future extension interfaces (no impl) | `src/extensions/index.ts` | Capacity/scheduling, integrations |
| Tests | `tests/*.test.ts` (Vitest) | Everyone; core owns engine tests |

Ownership: edit only your own layer. Changes to `core/types.ts` or the `Command` union affect everyone, so announce them first. UI never mutates state directly, only dispatches commands.

## Key model decisions
- Task statuses are FHIR R4 `Task.status`: draft, requested, received, accepted, rejected, in-progress, on-hold, completed, failed, cancelled. Transitions live in `TASK_TRANSITIONS`.
- **Overdue is derived** (`isOverdue`: due date passed and still outstanding). It is not stored, not `failed`, and is exported as `Task.businessStatus = overdue`.
- Transfer: draft → info-confirmed → handover-ready → sent → received (acknowledged) → accepted | rejected | clarification-requested.
- **One guard: `transferBlockers()`** (selectors) is used by sign-off (`confirmSenderInfo`), `sendTransfer`, `provideClarification`, `acceptTransfer` and `acceptTask`. For handover transfers it applies the receiver-profile validation. For legacy transfers it applies the pack's required fields. The UI never decides permissions.
- **Send rule:** a transfer can be sent only when every required field for the chosen receiver is GREEN and no identity discrepancy is open. AMBER on a required field blocks until a named professional confirms or corrects it. Optional fields never block.
- Accepting also needs a **named professional** in the receiving org. Complete information is not clinical acceptance.

### Handover validation (Prompt 2)
- Evidence-aware `HandoverField`: value, entry method (manual | deterministic-extraction | ai-extraction), verbatim evidence (quote plus offsets, checked by the engine at capture), ambiguity flag, confirmer and role, last update. A **manual entry has no evidence**: the old provenance is kept in the event history and never re-attributed. **Extracted ≠ confirmed.**
- The parser reads only "Label: value" lines using catalogue aliases. It flags malformed, empty and "TBC/?" values and never fixes them. Two different values for one field count as a **conflict**: RED and not confirmable until a person enters the correct value.
- `validateHandover(handover, profile, patient, documents)` is pure. Each field result carries reasons, a sender question and the profile rule id. Conditional requirements take only one form: `requiredWhen: { field, equals }`, where `field` may be the pseudo-field `transferKind`.
- Identity: the NHS number and DOB from the fields and from every source document are compared with the selected synthetic patient. A disagreement is a blocking **mismatch** and cannot be overridden. Missing identifiers make the result **unverified**, which also blocks unless a named professional records a manual check (`recordIdentityCheck`).
- Transfer kind (`discharge` | `referral` | `provider-move`) changes terminology, which profiles are offered, the sign-off roles and the simulated next-step label. All kinds share one engine.
- Profiles are **synthetic and not approved by any NHS receiver**. A profile names a destination role; a role is never treated as acceptance.
- Adding a receiver means registering a profile in `src/packs/receivers.ts` (plus any new field in `fields.ts`). The engine stays unchanged.
- `completeTask` needs status `in-progress` plus evidence (not future-dated). The evidence is stored on the task and in the event.
- Rejected or failed tasks stay that way until `reassignTask`, `redirectTransfer` or `cancelTask` (each needs a reason).
- `escalateTask` records an escalation without changing status or owner. The original requester is always kept.
- Events are append-only and frozen. Failed commands change nothing.
- The demo clock (`advanceClock`) is the only source of time. Seeds are deterministic.

## Adding a clinical pack
Create `src/packs/<name>.ts` exporting a `PathwayPack`, add it to `PACKS` in `src/packs/index.ts`, and run `npm test`. `tests/packs.test.ts` runs every pack through the same engine. No engine changes needed.

## Integration points (interfaces only — do not implement yet)
`src/extensions/index.ts`: `TransferExtractor` (document → fields with verbatim evidence; implemented only by the deterministic parser; OCR and model-based extraction are deferred), `CapacityProvider` (e.g. Heim slots), `FhirClient`, `PackBehaviour`. Later candidates: FHIR Questionnaire for receiver profiles, QuestionnaireResponse for handover fields. Not implemented. No UK Core, PRSB, e-RS, Shared PTL, DMAS, OPTICA or Heim integration is claimed.

## Working niche: cataract, NHS → independent sector (Prompt 3)
- Product name in the UI: **Relay**. The repo is still called doorstep.
- Demo sets (`src/scenarios/index.ts`): **cataract** (the default) and **generic**. Switch them in the header; switching resets to that set. The store remembers the current set.
- Pack `cataract-provider-move` (`src/packs/cataract.ts`) defines three tasks: book the first appointment (`marksAppointmentBooked`; booking is not treatment), pre-op assessment (counts as first care contact), and record the surgery outcome. Its `escalationRole` is `pathway-coordinator`. Timings are illustrative; the 4-day booking review deadline is synthetic, not a national standard.
- Profiles `independent-ophthalmology` (Brookfield, org-isp) and `nhs-ophthalmology` (Westmoor). Fields marked `confirmRoles` can only be confirmed by those roles: treatment plan and laterality by an ophthalmologist; the patient's agreement to the alternative provider by a coordinator or ophthalmologist. That agreement is a separate field from surgical consent.
- `capabilities` statements (e.g. "no GA on site") are **displayed only**. They never block or auto-reject; the receiving professional decides.
- Redirecting a handover transfer requires the sender to pick the new `receiverProfileId`. The handover is then re-validated. Relay never auto-routes.
- `laterality` is its own field format (right or left). The parser never infers it from free text.
- Dashboard pipeline (`computePipeline`): awaiting information / ready to send / sent, not accepted / accepted / rejected / accepted but awaiting appointment (with the escalation contact) / completed actions with evidence.
- Open clinical questions for the clinical lead are listed in the Prompt 3 report. Every clinical assumption is labelled "Illustrative — pending clinician sign-off".

## Provider comparison (`/compare`)
- `src/relay/shortlist.ts` (pure) + `src/relay/providerCatalogue.ts` (fictional catalogue, preferences, documented requirements). Administrative decision support only — no ML, no clinical triage.
- Layer A first: preference conflicts, missing info (unknown stays unknown), capacity status, and "Capability requires clinical review" flags raised only from requirements quoted verbatim from the synthetic record. Flagged providers are not positioned and not excluded.
- Layer B: illustrative score = weighted sum of min–max normalised wait, distance and the share of known non-clinical preferences met. Weights depend on the patient's stated priority and are demonstration assumptions. Ties break on wait, then distance, then id.
- `proposeDestination()` only returns a link into `/hub` (capture pre-selected, or the returned handover with the redirect profile pre-selected). It never dispatches a command. Agreement, clinical confirmation, sign-off and `transferBlockers()` are unchanged.
- Do not add suitability rules, real provider data or automatic rerouting here.

## Demo scenarios (Reset demo restores them; all built through the handover flow)
**Cataract set** (`src/scenarios/cataract.ts`, documents in `src/data/cataractDocuments.ts`): cat-A accepted, booking recorded, surgery open · cat-B GA-documented case rejected by Brookfield, sender keeps it · cat-C accepted, booking review deadline passed (escalate to Priya Shah) · cat-D laterality right vs left across two documents, unsent · live E = capture cdoc-E (laterality missing, agreement "To be confirmed").

**Generic set:**
- **A** tr-A: complete discharge handover (doc-1) to community care, accepted by Jo Mensah, first contact completed with evidence, another action scheduled (not done).
- **B** tr-B: complete GP referral (doc-2) to specialist outpatients, **rejected** with a reason. Unresolved and still owned by the GP sender.
- **C** tr-C: accepted. The first-contact deadline passed with no evidence, so it is overdue; escalate it live.
- **D** tr-D: ambiguous/contradictory (doc-4): allergies conflict, timing "TBC", interpreter language missing (conditional). **Unsent, awaiting sender confirmation**, with its questions shown.
- Live: capture doc-5 (missing allergies, empty contact), correct it, sign off, send, then accept or reject in `/receive`. doc-6 is the wrong-patient document. Click-through: `docs/DEMO-CHECKLIST.md`.

## Commands
`npm run dev` · `npm test` · `npm run build`

## Definition of done
- A synthetic transfer can be initiated (sender confirms info, generates handover, confirms deadlines, sends).
- The receiving service explicitly accepts (named professional) or rejects, or asks for clarification.
- At least one action is tracked to completion with recorded evidence.
- Missing information and overdue actions are visibly flagged.
- The dashboard accurately reflects the synthetic workflow.
- Reset restores known scenarios.
- `npm test` and `npm run build` pass.
