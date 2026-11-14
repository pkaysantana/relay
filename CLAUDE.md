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
| Pathway packs (config only) | `src/packs/{types,general,index}.ts` | Clinical packs |
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
- Accepting needs a **named professional** in the receiving org and **no missing required fields**.
- `completeTask` needs status `in-progress` plus evidence (not future-dated). The evidence is stored on the task and in the event.
- Rejected or failed tasks stay that way until `reassignTask`, `redirectTransfer` or `cancelTask` (each needs a reason).
- `escalateTask` records an escalation without changing status or owner. The original requester is always kept.
- Events are append-only and frozen. Failed commands change nothing.
- The demo clock (`advanceClock`) is the only source of time. Seeds are deterministic.

## Adding a clinical pack
Create `src/packs/<name>.ts` exporting a `PathwayPack`, add it to `PACKS` in `src/packs/index.ts`, and run `npm test`. `tests/packs.test.ts` runs every pack through the same engine. No engine changes needed.

## Integration points (interfaces only — do not implement yet)
`src/extensions/index.ts`: `TransferExtractor` (document → draft fields, human confirms), `CapacityProvider` (e.g. Heim slots), `FhirClient`, `PackBehaviour`.

## Demo scenarios (Reset demo restores them)
- **A** tr-A: complete info, accepted by community nursing, first contact completed with evidence, another action scheduled (not done).
- **B** tr-B: required info missing, reablement rejects. Unresolved on the sending side (redirect, reassign or cancel).
- **C** tr-C: accepted, first-contact deadline passed with no evidence. Overdue, so escalate it live.
- **D** tr-D: fresh draft for the live walkthrough (one required field missing on purpose).

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
