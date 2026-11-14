/**
 * P0 safety patch: patient refusal, unauthorised clinical confirmation, cataract sign-off policy.
 * Synthetic data; demonstration role policies only (not universal NHS workforce rules).
 */
import { describe, expect, it } from "vitest";
import { signOffRolesFor, type Command } from "@/core/engine";
import { handoverValidation } from "@/core/selectors";
import { bulkConfirmCandidates } from "@/core/validation";
import type { DemoState } from "@/core/types";
import { parseLabelledDocument } from "@/extraction/labelledParser";
import { communityCareProfile, getReceiverProfile, independentOphthalmologyProfile } from "@/packs/receivers";
import { createCataractSeedState, EYE_CONSULTANT, EYE_COORDINATOR } from "@/scenarios/cataract";
import { captureCommand, createSeedState, suggestedDeadlines } from "@/scenarios/seed";
import { dispatch, getDemoState, resetDemo } from "@/state/store";
import { err, ok, transfer } from "./helpers";

const RESTRICTED = ["treatmentPlan", "laterality", "medications", "allergies", "anaestheticRequirement", "anticoagulants", "alphaBlockers"];

const capture = (id: string, patientId: string, doc: string): Command =>
  captureCommand({
    actorId: EYE_COORDINATOR,
    transferId: id,
    patientId,
    sendingPractitionerId: EYE_CONSULTANT,
    transferKind: "provider-move",
    receiverProfileId: "independent-ophthalmology",
    documentIds: [doc],
  });

/** A second complete package for Patient F (cdoc-A has every restricted clinical field). */
const capturedFullA = () => ok(createCataractSeedState(), capture("cat-X", "pat-c1", "cdoc-A"));

/** Scenario E made complete except for the agreement field, confirmed by the ophthalmologist. */
function eReadyExceptAgreement(): DemoState {
  let s = ok(createCataractSeedState(), capture("cat-E", "pat-c5", "cdoc-E"));
  s = ok(s, { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "laterality", value: "right" });
  const keys = Object.values(transfer(s, "cat-E").handover!.fields).filter((f) => !f.confirmedBy && f.key !== "providerTransferAgreement").map((f) => f.key);
  return ok(s, keys.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-E", key })));
}

const agreementRow = (s: DemoState, id: string) =>
  handoverValidation(s, transfer(s, id))!.fields.find((f) => f.key === "providerTransferAgreement")!;

describe("1. a patient's refusal is never treated as agreement", () => {
  it("parser maps only explicit statements; everything else stays unresolved", () => {
    const parse = (v: string) =>
      parseLabelledDocument({ id: "p", title: "t", addedAt: "", text: `Patient agreement to alternative provider: ${v}` }).fields[0];
    expect(parse("Yes — agreed on 06/11/2026").value).toBe("agreed");
    expect(parse("No — patient declined").value).toBe("declined");
    expect(parse("Declined at clinic").value).toBe("declined");
    expect(parse("To be confirmed with patient")).toMatchObject({ value: "To be confirmed with patient", ambiguity: expect.stringMatching(/not an explicit agreement/) });
    expect(parse("Nothing recorded").ambiguity).toBeTruthy(); // "no" prefix needs a word boundary
  });

  it("a confirmed 'declined' is RED and blocks sign-off; Relay picks no other provider", () => {
    let s = eReadyExceptAgreement();
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "declined" },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
    ]);
    const row = agreementRow(s, "cat-E");
    expect(row).toMatchObject({ status: "red", blocking: true });
    expect(row.reasons.join(" ")).toMatch(/declined/i);
    expect(transfer(s, "cat-E").handover!.fields.providerTransferAgreement).toMatchObject({ confirmedBy: EYE_COORDINATOR }); // audit kept
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} })).toMatch(/declined/i);
    expect(transfer(s, "cat-E").receivingOrgId).toBeUndefined();
  });

  it("free text such as 'No — patient declined' entered manually is not accepted as a state", () => {
    let s = eReadyExceptAgreement();
    s = ok(s, { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "No — patient declined" });
    expect(agreementRow(s, "cat-E")).toMatchObject({ status: "amber", blocking: true });
    expect(err(s, { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" })).toMatch(/Agreed or Declined/);
  });

  it("unconfirmed agreement blocks; changing to 'declined' after sign-off withdraws sign-off and blocks sending", () => {
    let s = eReadyExceptAgreement();
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} })).toMatch(/Cannot sign off/);
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "agreed" },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
      { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} },
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "declined" },
    ]);
    expect(transfer(s, "cat-E").status).toBe("draft");
    expect(err(s, { type: "generateHandover", actorId: EYE_CONSULTANT, transferId: "cat-E" })).toBeTruthy();
  });

  it("send guard rejects a declined agreement even if state was tampered after sign-off", () => {
    let s = eReadyExceptAgreement();
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "agreed" },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
      { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} },
      { type: "generateHandover", actorId: EYE_CONSULTANT, transferId: "cat-E" },
    ]);
    const tampered = structuredClone(s);
    transfer(tampered, "cat-E").handover!.fields.providerTransferAgreement.value = "declined";
    expect(
      err(tampered, { type: "sendTransfer", actorId: EYE_CONSULTANT, transferId: "cat-E", receivingOrgId: "org-isp", deadlines: suggestedDeadlines(tampered, "cat-E") }),
    ).toMatch(/Cannot send: .*declined/i);
  });

  it("store level: declined blocks sign-off through dispatch, and reset restores the demo", () => {
    resetDemo("cataract");
    const must = (r: ReturnType<typeof dispatch>) => {
      if (!r.ok) throw new Error(r.error);
    };
    must(dispatch(capture("cat-S", "pat-c5", "cdoc-E")));
    must(dispatch({ type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-S", key: "providerTransferAgreement", value: "declined" }));
    must(dispatch({ type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-S", key: "providerTransferAgreement" }));
    const r = dispatch({ type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-S", fields: {} });
    expect(r.ok).toBe(false);
    resetDemo("cataract");
    expect(getDemoState()).toEqual(createCataractSeedState());
  });
});

describe("2. coordinators cannot confirm restricted clinical information", () => {
  it("each restricted field: coordinator may enter it but not confirm it; ophthalmologist may", () => {
    let s = capturedFullA();
    for (const key of RESTRICTED) {
      expect(transfer(s, "cat-X").handover!.fields[key]).toBeTruthy(); // present in cdoc-A
      expect(err(s, { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-X", key })).toMatch(/must be confirmed by: ophthalmologist/);
    }
    s = ok(s, { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-X", key: "allergies", value: "None known (transcribed)" });
    s = ok(s, RESTRICTED.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-X", key })));
    expect(RESTRICTED.every((k) => transfer(s, "cat-X").handover!.fields[k].confirmedRole === "ophthalmologist")).toBe(true);
  });

  it("bulk confirmation offers no restricted field to a coordinator and cannot bypass the engine", () => {
    const s0 = capturedFullA();
    const h = transfer(s0, "cat-X").handover!;
    const coordinatorKeys = bulkConfirmCandidates(h, independentOphthalmologyProfile, "pathway-coordinator");
    expect(coordinatorKeys.filter((k) => RESTRICTED.includes(k))).toEqual([]);
    expect(bulkConfirmCandidates(h, independentOphthalmologyProfile, "ophthalmologist")).toEqual(expect.arrayContaining(RESTRICTED));
    // Simulate the bulk button for the coordinator: every eligible confirmation succeeds, none restricted.
    const s = ok(s0, coordinatorKeys.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-X", key })));
    for (const k of RESTRICTED) expect(transfer(s, "cat-X").handover!.fields[k].confirmedBy).toBeUndefined();
    // Even if a bulk list were forged to include a restricted field, the engine refuses it.
    expect(err(s, { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-X", key: "treatmentPlan" })).toMatch(/ophthalmologist/);
  });
});

describe("3. cataract sign-off follows the receiver's policy, enforced in the engine", () => {
  const withSendingGp = (s: DemoState): DemoState => ({
    ...s,
    practitioners: [...s.practitioners, { id: "prac-eye-gp", name: "Dr Test GP (synthetic)", role: "gp", orgId: "org-eye" }],
  });
  const allConfirmed = () => {
    let s = withSendingGp(capturedFullA());
    const keys = Object.values(transfer(s, "cat-X").handover!.fields).filter((f) => !f.confirmedBy).map((f) => f.key);
    s = ok(s, keys.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-X", key })));
    expect(handoverValidation(s, transfer(s, "cat-X"))!.blocking).toBe(false);
    return s;
  };

  it("policy resolution: cataract profiles → ophthalmologist; generic profiles keep kind defaults", () => {
    expect(signOffRolesFor({ transferKind: "provider-move", receiverProfileId: "independent-ophthalmology" })).toEqual(["ophthalmologist"]);
    expect(signOffRolesFor({ transferKind: "provider-move", receiverProfileId: "nhs-ophthalmology" })).toEqual(["ophthalmologist"]);
    expect(signOffRolesFor({ transferKind: "provider-move", receiverProfileId: "specialist-outpatient" })).toContain("gp");
    expect(getReceiverProfile("community-care").signOffRoles).toBeUndefined();
    expect(communityCareProfile.transferKinds).toContain("discharge");
  });

  it("GP and coordinator are refused; the ophthalmologist may sign off", () => {
    const s = allConfirmed();
    expect(err(s, { type: "confirmSenderInfo", actorId: "prac-eye-gp", transferId: "cat-X", fields: {} })).toMatch(/needs one of these roles: ophthalmologist \(you are gp\)/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_COORDINATOR, transferId: "cat-X", fields: {} })).toMatch(/you are pathway-coordinator/);
    expect(transfer(ok(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-X", fields: {} }), "cat-X").status).toBe("info-confirmed");
  });

  it("generic discharge and referral sign-off still work", () => {
    const g = createSeedState();
    expect(transfer(g, "tr-A").senderConfirmedRole).toBe("discharging-clinician"); // discharge
    expect(transfer(g, "tr-B").senderConfirmedRole).toBe("gp"); // referral by GP
  });
});
