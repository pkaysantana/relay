import { describe, expect, it } from "vitest";
import { handoverValidation } from "@/core/selectors";
import { validateHandover } from "@/core/validation";
import type { Handover } from "@/core/types";
import { PREPARED_DOCUMENTS } from "@/data/documents";
import { parseLabelledDocument } from "@/extraction/labelledParser";
import { computeMetrics } from "@/metrics/dashboard";
import { communityCareProfile, specialistOutpatientProfile, type ReceiverProfile } from "@/packs/receivers";
import { captureCommand, confirmCommands, createSeedState, suggestedDeadlines } from "@/scenarios/seed";
import { dispatch, getDemoState, resetDemo } from "@/state/store";
import { capturedE, err, ok, readyE, seed, transfer, WARD } from "./helpers";

const fieldStatus = (s: ReturnType<typeof seed>, id: string, key: string) =>
  handoverValidation(s, transfer(s, id))!.fields.find((f) => f.key === key)!;

describe("deterministic labelled parser", () => {
  it("keeps verbatim quotes with exact offsets", () => {
    for (const d of PREPARED_DOCUMENTS) {
      for (const f of parseLabelledDocument({ ...d, addedAt: "" }).fields) {
        expect(d.text.slice(f.evidence.start, f.evidence.end)).toBe(f.evidence.quote);
      }
    }
  });

  it("normalises identifiers and flags malformed/empty/ambiguous values without fixing them", () => {
    const r = parseLabelledDocument({
      id: "x",
      title: "malformed",
      addedAt: "",
      text: "Patient ID: 12345\nDate of birth: 31/02/1970\nContact:\nAgreed timing: TBC\nFavourite colour: blue\nno label here",
    });
    const by = Object.fromEntries(r.fields.map((f) => [f.key, f]));
    expect(by.patientId.ambiguity).toMatch(/10-digit/);
    expect(by.dateOfBirth.ambiguity).toMatch(/date/);
    expect(by.agreedTiming.ambiguity).toMatch(/TBC/);
    expect(by.contactArrangement).toBeUndefined();
    expect(r.warnings.join(" ")).toMatch(/Contact.*empty/);
    expect(r.warnings.join(" ")).toMatch(/Favourite colour.*not recognised/);
  });

  it("handles an empty document safely", () => {
    const r = parseLabelledDocument({ id: "e", title: "empty", addedAt: "", text: "" });
    expect(r.fields).toEqual([]);
    expect(r.warnings[0]).toMatch(/no labelled fields/);
  });
});

describe("Prompt 2 scenarios", () => {
  it("A: complete handover is accepted by a named receiving professional", () => {
    const s = seed();
    const t = transfer(s, "tr-A");
    expect(t.status).toBe("accepted");
    expect(t.receivingPractitionerId).toBe("prac-cn-1");
    expect(handoverValidation(s, t)!.blocking).toBe(false);
    expect(t.senderConfirmedRole).toBe("discharging-clinician");
  });

  it("B: missing required field is identified, corrected by the sender, then sendable", () => {
    let s = capturedE();
    expect(fieldStatus(s, "tr-E", "allergies").status).toBe("red");
    expect(fieldStatus(s, "tr-E", "contactArrangement").status).toBe("red");
    const v = handoverValidation(s, transfer(s, "tr-E"))!;
    expect(v.questions.join(" ")).toMatch(/allergy status/);
    expect(err(s, { type: "confirmSenderInfo", actorId: WARD, transferId: "tr-E", fields: {} })).toMatch(/Cannot sign off: .*Allergies/);
    s = readyE();
    expect(handoverValidation(s, transfer(s, "tr-E"))!.blocking).toBe(false);
    s = ok(s, { type: "sendTransfer", actorId: WARD, transferId: "tr-E", receivingOrgId: "org-community", deadlines: suggestedDeadlines(s, "tr-E") });
    expect(transfer(s, "tr-E").status).toBe("sent");
  });

  it("C: ambiguous / contradictory information stays unconfirmed and blocks sending", () => {
    const s = seed();
    const t = transfer(s, "tr-D");
    expect(t.status).toBe("draft");
    expect(fieldStatus(s, "tr-D", "allergies").status).toBe("red"); // Penicillin vs None known
    expect(fieldStatus(s, "tr-D", "agreedTiming").status).toBe("amber"); // TBC
    expect(fieldStatus(s, "tr-D", "interpreterLanguage")).toMatchObject({ status: "red", required: true }); // conditional
    expect(err(s, { type: "confirmHandoverField", actorId: WARD, transferId: "tr-D", key: "allergies" })).toMatch(/disagree/);
    expect(err(s, { type: "confirmSenderInfo", actorId: WARD, transferId: "tr-D", fields: {} })).toMatch(/Cannot sign off/);
    expect(handoverValidation(s, t)!.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("D: information-complete referral rejected; reason and responsibility preserved", () => {
    const s = seed();
    const t = transfer(s, "tr-B");
    expect(handoverValidation(s, t)!.blocking).toBe(false);
    expect(t.status).toBe("rejected");
    expect(t.decisions.at(-1)).toMatchObject({ outcome: "rejected", by: "prac-op-1" });
    expect(t.decisions.at(-1)!.reason).toMatch(/does not provide/);
    expect(t.sendingPractitionerId).toBe("prac-gp-1");
    expect(t.receivingPractitionerId).toBeUndefined();
    expect(s.events.some((e) => e.transferId === "tr-B" && e.type === "rejectTransfer")).toBe(true);
  });
});

describe("validation rules", () => {
  it("missing optional information does not block", () => {
    const s = readyE(); // doc-5 has no access notes / requested action (optional)
    const v = handoverValidation(s, transfer(s, "tr-E"))!;
    expect(v.fields.find((f) => f.key === "accessNotes")!.status).toBe("absent-optional");
    expect(v.blocking).toBe(false);
  });

  it("required but unconfirmed information never passes silently", () => {
    const s = capturedE();
    const f = fieldStatus(s, "tr-E", "medications");
    expect(f.status).toBe("amber");
    expect(f.blocking).toBe(true);
  });

  it("wrong-patient evidence is detected and cannot be overridden", () => {
    const s = capturedE(seed(), ["doc-5", "doc-6"]);
    const v = handoverValidation(s, transfer(s, "tr-E"))!;
    expect(v.identity.status).toBe("mismatch");
    expect(v.identity.reasons.join(" ")).toMatch(/Medication list.*999 000 0001/);
    expect(err(s, { type: "recordIdentityCheck", actorId: WARD, transferId: "tr-E", note: "Looked fine" })).toMatch(/cannot be overridden/);
  });

  it("absent identifiers are 'unverified', not a match, until a manual check is recorded", () => {
    const s0 = capturedE();
    let s = ok(s0, [
      { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "patientId", value: "" },
      { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "dateOfBirth", value: "" },
    ]);
    const v = handoverValidation(s, transfer(s, "tr-E"))!;
    expect(v.identity.status).toBe("unverified");
    expect(v.identity.blocking).toBe(true);
    s = ok(s, { type: "recordIdentityCheck", actorId: WARD, transferId: "tr-E", note: "Checked wristband against PAS (synthetic)" });
    expect(handoverValidation(s, transfer(s, "tr-E"))!.identity.status).toBe("manually-checked");
  });

  it("a manual entry is never attributed to a source document", () => {
    let s = capturedE();
    expect(transfer(s, "tr-E").handover!.fields.medications.evidence).toHaveLength(1);
    s = ok(s, { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "medications", value: "Changed list SYN-MED-0099" });
    const f = transfer(s, "tr-E").handover!.fields.medications;
    expect(f.entryMethod).toBe("manual");
    expect(f.evidence).toEqual([]);
    expect(f.confirmedBy).toBeUndefined();
    const ev = s.events.at(-1)!;
    expect(ev.data!.previousEvidence).toHaveLength(1); // old provenance preserved in history
  });

  it("fabricated quotes are refused at capture", () => {
    const cmd = captureCommand({ actorId: WARD, transferId: "tr-F", patientId: "pat-5", sendingPractitionerId: WARD, transferKind: "discharge", receiverProfileId: "community-care", documentIds: ["doc-5"] }) as Extract<Parameters<typeof ok>[1], { type: "createHandover" }>;
    cmd.extracted[0] = { ...cmd.extracted[0], evidence: { ...cmd.extracted[0].evidence, quote: "Allergies: none" } };
    expect(err(seed(), cmd)).toMatch(/not a verbatim quote/);
  });

  it("changing the receiver profile changes validation without engine changes", () => {
    const s = seed();
    const h = transfer(s, "tr-A").handover!;
    const patient = s.patients.find((p) => p.id === "pat-1");
    const asCommunity = validateHandover(h, communityCareProfile, patient, s.documents);
    const asOutpatient = validateHandover(h, specialistOutpatientProfile, patient, s.documents);
    expect(asCommunity.blocking).toBe(false);
    expect(asOutpatient.blocking).toBe(true);
    expect(asOutpatient.blockingReasons.join(" ")).toMatch(/Existing clinical assessment/);
    // A brand-new profile registered at runtime works with the same function.
    const strict: ReceiverProfile = { ...communityCareProfile, id: "strict", fields: [...communityCareProfile.fields, { key: "accessNotes", required: true, prompt: "Access?" }] };
    expect(validateHandover(h, strict, patient, s.documents).blocking).toBe(false); // doc-1 has confirmed access notes
  });

  it("conditional requirement: required only when field X has value Y (incl. transferKind)", () => {
    const h: Handover = { transferKind: "referral", receiverProfileId: "specialist-outpatient", documentIds: [], fields: {}, extractionWarnings: [] };
    const prev = (kind: Handover["transferKind"]) =>
      validateHandover({ ...h, transferKind: kind }, specialistOutpatientProfile, undefined, []).fields.find((f) => f.key === "previousProvider")!;
    expect(prev("referral")).toMatchObject({ required: false, status: "absent-optional" });
    expect(prev("provider-move")).toMatchObject({ required: true, status: "red" });
  });

  it("sign-off requires a role allowed for the transfer kind", () => {
    let s = capturedE();
    s = ok(s, [
      { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "allergies", value: "None known" },
      { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "contactArrangement", value: "Patient" },
    ]);
    s = ok(s, confirmCommands(s, "tr-E", WARD));
    expect(err(s, { type: "confirmSenderInfo", actorId: "prac-ward-2", transferId: "tr-E", fields: {} })).toMatch(/needs one of these roles/);
  });

  it("send rule: a handover can only go to its profile's service", () => {
    const s = readyE();
    expect(err(s, { type: "sendTransfer", actorId: WARD, transferId: "tr-E", receivingOrgId: "org-reablement", deadlines: suggestedDeadlines(s, "tr-E") })).toMatch(/prepared for/);
  });
});

describe("integration: capture → review → send → receive through the store", () => {
  it("runs the full UI command sequence and reset restores the scenarios", () => {
    resetDemo("generic");
    const must = (r: ReturnType<typeof dispatch>) => {
      if (!r.ok) throw new Error(r.error);
    };
    must(dispatch(captureCommand({ actorId: WARD, transferId: "tr-UI", patientId: "pat-5", sendingPractitionerId: WARD, transferKind: "discharge", receiverProfileId: "community-care", documentIds: ["doc-5"] })));
    const blocked = dispatch({ type: "confirmSenderInfo", actorId: WARD, transferId: "tr-UI", fields: {} });
    expect(blocked.ok).toBe(false);
    must(dispatch({ type: "updateHandoverField", actorId: WARD, transferId: "tr-UI", key: "allergies", value: "None known" }));
    must(dispatch({ type: "updateHandoverField", actorId: WARD, transferId: "tr-UI", key: "contactArrangement", value: "Patient, 01632 960005 (synthetic)" }));
    for (const key of Object.keys(transfer(getDemoState(), "tr-UI").handover!.fields))
      must(dispatch({ type: "confirmHandoverField", actorId: WARD, transferId: "tr-UI", key }));
    must(dispatch({ type: "confirmSenderInfo", actorId: WARD, transferId: "tr-UI", fields: {} }));
    must(dispatch({ type: "generateHandover", actorId: WARD, transferId: "tr-UI" }));
    expect(dispatch({ type: "sendTransfer", actorId: WARD, transferId: "tr-UI", receivingOrgId: "org-community", deadlines: {} }).ok).toBe(false); // deadlines must be confirmed
    must(dispatch({ type: "sendTransfer", actorId: WARD, transferId: "tr-UI", receivingOrgId: "org-community", deadlines: suggestedDeadlines(getDemoState(), "tr-UI") }));
    expect(transfer(getDemoState(), "tr-UI").status).toBe("sent");
    must(dispatch({ type: "acknowledgeTransfer", actorId: "prac-cn-2", transferId: "tr-UI" }));
    expect(dispatch({ type: "acceptTransfer", actorId: "prac-cn-2", transferId: "tr-UI" }).ok).toBe(false); // no named professional
    must(dispatch({ type: "acceptTransfer", actorId: "prac-cn-2", transferId: "tr-UI", responsiblePractitionerId: "prac-cn-2" }));
    const done = getDemoState();
    expect(transfer(done, "tr-UI")).toMatchObject({ status: "accepted", receivingPractitionerId: "prac-cn-2", senderConfirmedBy: WARD });
    expect(done.tasks.filter((k) => k.transferId === "tr-UI").every((k) => k.status === "accepted")).toBe(true); // accepted ≠ completed

    resetDemo("generic");
    expect(getDemoState()).toEqual(createSeedState());
  });
});

describe("dashboard additions", () => {
  it("missing required fields at capture are grouped by profile and field, from events", () => {
    const m = computeMetrics(seed());
    const d = m.missingAtCapture.find((x) => x.profileId === "community-care" && x.key === "interpreterLanguage");
    expect(d?.count).toBe(1);
  });

  it("time from handover submission to acceptance is computed from events", () => {
    const m = computeMetrics(seed());
    expect(m.handoverToAcceptance.samples).toBe(2);
    expect(m.handoverToAcceptance.median).toBe(5); // A: 4h, C: 6h
  });
});
