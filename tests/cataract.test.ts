/**
 * Cataract demonstration — small deterministic evaluation set (synthetic scenarios A–E).
 * These tests show the software behaves as specified on synthetic data. They are NOT
 * evidence of real-world clinical or operational performance.
 */
import { describe, expect, it } from "vitest";
import { applyAll, type Command } from "@/core/engine";
import { handoverValidation } from "@/core/selectors";
import { validateHandover } from "@/core/validation";
import type { DemoState } from "@/core/types";
import { computeMetrics } from "@/metrics/dashboard";
import { communityCareProfile, independentOphthalmologyProfile, nhsOphthalmologyProfile } from "@/packs/receivers";
import { DEMO_SETS } from "@/scenarios";
import {
  createCataractSeedState,
  EYE_CONSULTANT,
  EYE_COORDINATOR,
  ISP_COORDINATOR,
  ISP_SURGEON,
} from "@/scenarios/cataract";
import { captureCommand, suggestedDeadlines } from "@/scenarios/seed";
import { getDemoState, resetDemo } from "@/state/store";
import { err, ok, task, transfer } from "./helpers";

const field = (s: DemoState, id: string, key: string) => handoverValidation(s, transfer(s, id))!.fields.find((f) => f.key === key)!;

/** Scenario E capture as the eye-service coordinator (responsible professional: the consultant). */
function captureE(): DemoState {
  return ok(
    createCataractSeedState(),
    captureCommand({
      actorId: EYE_COORDINATOR,
      transferId: "cat-E",
      patientId: "pat-c5",
      sendingPractitionerId: EYE_CONSULTANT,
      transferKind: "provider-move",
      receiverProfileId: "independent-ophthalmology",
      documentIds: ["cdoc-E"],
    }),
  );
}

const AGREEMENT = "agreed"; // controlled state: agreed | declined

/** Full live-demo sequence: correct → confirm (two roles) → sign off → send → accept. */
function runE(): DemoState {
  let s = captureE();
  s = ok(s, [
    { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: AGREEMENT },
    { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
    { type: "updateHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-E", key: "laterality", value: "right" },
  ]);
  const unconfirmed = Object.values(transfer(s, "cat-E").handover!.fields).filter((f) => !f.confirmedBy).map((f) => f.key);
  s = ok(s, unconfirmed.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-E", key })));
  s = ok(s, [
    { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} },
    { type: "generateHandover", actorId: EYE_CONSULTANT, transferId: "cat-E" },
  ]);
  s = ok(s, { type: "sendTransfer", actorId: EYE_CONSULTANT, transferId: "cat-E", receivingOrgId: "org-isp", deadlines: suggestedDeadlines(s, "cat-E") });
  return ok(s, [
    { type: "acknowledgeTransfer", actorId: ISP_COORDINATOR, transferId: "cat-E" },
    { type: "acceptTransfer", actorId: ISP_SURGEON, transferId: "cat-E", responsiblePractitionerId: ISP_SURGEON },
  ]);
}

describe("cataract demo seed", () => {
  it("builds the four seeded scenarios in their expected states", () => {
    const s = createCataractSeedState();
    expect(transfer(s, "cat-A").status).toBe("accepted");
    expect(transfer(s, "cat-B").status).toBe("rejected");
    expect(transfer(s, "cat-C").status).toBe("accepted");
    expect(transfer(s, "cat-D").status).toBe("draft");
    expect(s.transfers.every((t) => t.packId === "cataract-provider-move")).toBe(true);
  });
});

describe("1. required missing information is detected (scenario E)", () => {
  it("laterality missing → RED with a question; agreement 'to be confirmed' → AMBER; send blocked", () => {
    const s = captureE();
    expect(field(s, "cat-E", "laterality")).toMatchObject({ status: "red", blocking: true });
    expect(field(s, "cat-E", "providerTransferAgreement").status).toBe("amber");
    expect(field(s, "cat-E", "providerTransferAgreement").reasons.join(" ")).toMatch(/to be confirmed/i);
    const v = handoverValidation(s, transfer(s, "cat-E"))!;
    expect(v.questions.join(" ")).toMatch(/Which eye/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} })).toMatch(/Cannot sign off/);
  });

  it("the parser never infers laterality from free text (plan says 'Right cataract surgery')", () => {
    const s = captureE();
    expect(transfer(s, "cat-E").handover!.fields.treatmentPlan.value).toMatch(/^Right/);
    expect(transfer(s, "cat-E").handover!.fields.laterality).toBeUndefined();
  });

  it("E end-to-end: corrected, confirmed, signed off, sent and accepted; dashboard reflects it", () => {
    const before = computeMetrics(createCataractSeedState()).pipeline;
    const s = runE();
    const t = transfer(s, "cat-E");
    expect(t).toMatchObject({ status: "accepted", receivingPractitionerId: ISP_SURGEON, senderConfirmedBy: EYE_CONSULTANT });
    const after = computeMetrics(s).pipeline;
    expect(after.accepted.length).toBe(before.accepted.length + 1);
    expect(after.awaitingAppointment.some((x) => x.transfer.id === "cat-E")).toBe(true);
  });
});

describe("2. optional missing information does not block", () => {
  it("cat-A has no refraction/biometry (optional) and was still sent and accepted", () => {
    const s = createCataractSeedState();
    expect(field(s, "cat-A", "refraction").status).toBe("absent-optional");
    expect(field(s, "cat-A", "biometry").status).toBe("absent-optional");
    expect(handoverValidation(s, transfer(s, "cat-A"))!.blocking).toBe(false);
  });

  it("conditional: previous eye procedures required only for a second eye (cat-C)", () => {
    const s = createCataractSeedState();
    expect(field(s, "cat-C", "previousEyeProcedures")).toMatchObject({ required: true, status: "green" });
    expect(field(s, "cat-A", "previousEyeProcedures")).toMatchObject({ required: false, status: "absent-optional" });
  });
});

describe("3. contradictory sources are not automatically confirmed (scenario D)", () => {
  it("laterality right vs left → RED, cannot be confirmed or signed off until a clinician resolves it", () => {
    let s = createCataractSeedState();
    expect(field(s, "cat-D", "laterality").status).toBe("red");
    expect(field(s, "cat-D", "laterality").reasons[0]).toMatch(/"right" vs "left"/);
    expect(err(s, { type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-D", key: "laterality" })).toMatch(/disagree/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-D", fields: {} })).toMatch(/Cannot sign off/);
    // Human resolution: consultant enters the correct eye, then confirms.
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-D", key: "laterality", value: "right" },
      { type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-D", key: "laterality" },
      { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-D", fields: {} },
    ]);
    expect(transfer(s, "cat-D").status).toBe("info-confirmed");
  });
});

describe("4. provider rejection does not transfer responsibility (scenario B)", () => {
  it("rejected with reason; no receiving professional; sender still responsible; tasks need action", () => {
    const s = createCataractSeedState();
    const t = transfer(s, "cat-B");
    expect(handoverValidation(s, t)!.blocking).toBe(false); // information was complete
    expect(t.status).toBe("rejected");
    expect(t.receivingPractitionerId).toBeUndefined();
    expect(t.sendingPractitionerId).toBe(EYE_CONSULTANT);
    expect(t.decisions.at(-1)).toMatchObject({ outcome: "rejected", by: ISP_SURGEON });
    expect(t.decisions.at(-1)!.reason).toMatch(/general anaesthesia/);
    expect(s.tasks.filter((k) => k.transferId === "cat-B").every((k) => k.status === "rejected" && !k.ownerPractitionerId)).toBe(true);
    expect(computeMetrics(s).pipeline.rejected.map((x) => x.id)).toContain("cat-B");
  });

  it("redirection is explicit: the sender picks the new service profile; it is re-validated; no acceptance implied", () => {
    let s = createCataractSeedState();
    expect(err(s, { type: "redirectTransfer", actorId: EYE_CONSULTANT, transferId: "cat-B", receivingOrgId: "org-westmoor", note: "Needs GA" })).toMatch(/receiver profile/);
    s = ok(s, { type: "redirectTransfer", actorId: EYE_CONSULTANT, transferId: "cat-B", receivingOrgId: "org-westmoor", receiverProfileId: "nhs-ophthalmology", note: "Plan requires GA; redirecting to a hospital service" });
    const t = transfer(s, "cat-B");
    expect(t).toMatchObject({ status: "sent", receivingOrgId: "org-westmoor", receivingPractitionerId: undefined });
    expect(t.handover!.receiverProfileId).toBe("nhs-ophthalmology");
  });

  it("capability statements never auto-reject: the GA case validates cleanly against the independent provider", () => {
    const s = createCataractSeedState();
    const t = transfer(s, "cat-B");
    const p = s.patients.find((x) => x.id === t.patientId);
    expect(validateHandover(t.handover!, independentOphthalmologyProfile, p, s.documents).blocking).toBe(false);
  });
});

describe("5. appointment booking does not equal completed surgery (scenario A)", () => {
  it("booking recorded with evidence; pre-op scheduled but open; surgery task not completed", () => {
    const s = createCataractSeedState();
    expect(task(s, "cat-A", "book-first-appointment")).toMatchObject({ status: "completed" });
    expect(task(s, "cat-A", "book-first-appointment").evidence!.summary).toMatch(/Booking only/);
    expect(task(s, "cat-A", "preop-assessment")).toMatchObject({ status: "accepted", scheduledFor: "2026-11-20T10:00:00.000Z" });
    expect(task(s, "cat-A", "surgery-outcome").status).toBe("accepted");
    expect(computeMetrics(s).hoursToFirstContact.samples).toBe(0); // booking is not a care contact
  });
});

describe("6. accepted but unresolved next action remains visible (scenario C)", () => {
  it("booking review deadline passed with no booking → overdue, with the escalation contact", () => {
    const s = createCataractSeedState();
    const row = computeMetrics(s).pipeline.awaitingAppointment.find((x) => x.transfer.id === "cat-C")!;
    expect(row.overdue).toBe(true);
    expect(row.task.status).toBe("accepted");
    expect(row.escalationContact?.id).toBe(EYE_COORDINATOR);
    expect(computeMetrics(s).overdueByTeam.find((g) => g.orgId === "org-isp")!.tasks.map((k) => k.transferId)).toEqual(["cat-C"]);
  });
});

describe("7. manual confirmation has a named professional and an audit event", () => {
  it("coordinator confirms the patient's agreement; role-restricted fields need the ophthalmologist", () => {
    let s = captureE();
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: AGREEMENT },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
    ]);
    const f = transfer(s, "cat-E").handover!.fields.providerTransferAgreement;
    expect(f).toMatchObject({ entryMethod: "manual", evidence: [], confirmedBy: EYE_COORDINATOR, confirmedRole: "pathway-coordinator" });
    expect(s.events.at(-1)).toMatchObject({ type: "confirmHandoverField", actorId: EYE_COORDINATOR, data: expect.objectContaining({ key: "providerTransferAgreement" }) });
    s = ok(s, { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "laterality", value: "right" });
    expect(err(s, { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "laterality" })).toMatch(/must be confirmed by: ophthalmologist/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_COORDINATOR, transferId: "cat-E", fields: {} })).toBeTruthy();
  });
});

describe("8. different receiver profiles give different validation results", () => {
  it("the same cataract handover passes the cataract profiles but not the community-care profile", () => {
    const s = createCataractSeedState();
    const t = transfer(s, "cat-A");
    const p = s.patients.find((x) => x.id === t.patientId);
    expect(validateHandover(t.handover!, independentOphthalmologyProfile, p, s.documents).blocking).toBe(false);
    expect(validateHandover(t.handover!, nhsOphthalmologyProfile, p, s.documents).blocking).toBe(false);
    const community = validateHandover(t.handover!, communityCareProfile, p, s.documents);
    expect(community.blocking).toBe(true);
    expect(community.blockingReasons.join(" ")).toMatch(/Care requirements/);
  });
});

describe("9. generic packs and Prompt 2 scenarios still work", () => {
  it("generic demo set seeds its scenarios", () => {
    const g = DEMO_SETS.generic.create();
    expect(["tr-A", "tr-B", "tr-C", "tr-D"].map((id) => transfer(g, id).status)).toEqual(["accepted", "rejected", "accepted", "draft"]);
  });
});

describe("10. reset restores the complete demo", () => {
  it("cataract seed is deterministic and reset restores it after changes", () => {
    expect(createCataractSeedState()).toEqual(createCataractSeedState());
    resetDemo("cataract");
    const live = applyAll(getDemoState(), []);
    expect(live).toEqual(createCataractSeedState());
    resetDemo("generic");
    expect(transfer(getDemoState(), "tr-A")).toBeTruthy();
    resetDemo("cataract");
    expect(getDemoState()).toEqual(createCataractSeedState());
  });
});
