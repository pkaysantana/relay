/** Lovable-derived screens read the canonical engine state (no separate store). Synthetic data only. */
import { describe, expect, it } from "vitest";
import type { Command } from "@/core/engine";
import { computeMetrics } from "@/metrics/dashboard";
import { patientJourney, todoItems, todoTiles } from "@/relay/view";
import { createCataractSeedState, EYE_CONSULTANT, EYE_COORDINATOR, ISP_COORDINATOR, ISP_SURGEON } from "@/scenarios/cataract";
import { captureCommand, suggestedDeadlines } from "@/scenarios/seed";
import { ok, transfer } from "./helpers";

const captureE = () =>
  ok(
    createCataractSeedState(),
    captureCommand({ actorId: EYE_COORDINATOR, transferId: "cat-E", patientId: "pat-c5", sendingPractitionerId: EYE_CONSULTANT, transferKind: "provider-move", receiverProfileId: "independent-ophthalmology", documentIds: ["cdoc-E"] }),
  );

describe("coordinator To-do is derived from engine state", () => {
  it("seed: overdue booking first, then rejected and awaiting-information items", () => {
    const s = createCataractSeedState();
    const items = todoItems(s);
    expect(items[0]).toMatchObject({ transferId: "cat-C", overdue: true, button: "Escalate" });
    expect(items[0].detail).toMatch(/Priya Shah/);
    expect(items.find((i) => i.transferId === "cat-B")).toMatchObject({ title: "Returned by receiver" });
    expect(items.find((i) => i.transferId === "cat-B")!.owner).toMatch(/Mr Tomas Reyes.*responsibility stays with the sending team/);
    expect(items.find((i) => i.transferId === "cat-D")).toMatchObject({ title: "Handover awaiting information", href: "/hub?t=cat-D" });
    expect(todoTiles(s)).toEqual({ overdue: 1, needsAction: 2, completedWithEvidence: computeMetrics(s).pipeline.completedWithEvidence.length });
  });

  it("scenario E moves through To-do and patient view as the engine state changes", () => {
    let s = captureE();
    expect(todoItems(s).find((i) => i.transferId === "cat-E")!.title).toBe("Handover awaiting information");
    expect(patientJourney(s, transfer(s, "cat-E"))).toMatchObject({ step: 0, returned: false });

    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "agreed" },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
      { type: "updateHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-E", key: "laterality", value: "right" },
    ]);
    const rest = Object.values(transfer(s, "cat-E").handover!.fields).filter((f) => !f.confirmedBy).map((f) => f.key);
    s = ok(s, rest.map((key): Command => ({ type: "confirmHandoverField", actorId: EYE_CONSULTANT, transferId: "cat-E", key })));
    expect(todoItems(s).find((i) => i.transferId === "cat-E")!.title).toBe("Handover ready to sign off and send");

    s = ok(s, [
      { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} },
      { type: "generateHandover", actorId: EYE_CONSULTANT, transferId: "cat-E" },
    ]);
    s = ok(s, { type: "sendTransfer", actorId: EYE_CONSULTANT, transferId: "cat-E", receivingOrgId: "org-isp", deadlines: suggestedDeadlines(s, "cat-E") });
    expect(todoItems(s).find((i) => i.transferId === "cat-E")!.owner).toMatch(/until a named receiving professional accepts/);
    expect(patientJourney(s, transfer(s, "cat-E")).step).toBe(1);

    s = ok(s, [
      { type: "acknowledgeTransfer", actorId: ISP_COORDINATOR, transferId: "cat-E" },
      { type: "acceptTransfer", actorId: ISP_SURGEON, transferId: "cat-E", responsiblePractitionerId: ISP_SURGEON },
    ]);
    expect(s.events.at(-1)).toMatchObject({ type: "acceptTransfer", actorId: ISP_SURGEON, toStatus: "accepted" });
    const j = patientJourney(s, transfer(s, "cat-E"));
    expect(j.step).toBe(2);
    expect(j.lookingAfter).toMatch(/Dr Helen Ward.*local pathway and agreement/);
    expect(j.next).toMatch(/Booking not yet confirmed/);
    expect(todoItems(s).find((i) => i.transferId === "cat-E")!.title).toMatch(/awaiting appointment/);
  });

  it("patient view: booking recorded is not surgery; rejection keeps the sending team", () => {
    const s = createCataractSeedState();
    expect(patientJourney(s, transfer(s, "cat-A"))).toMatchObject({ step: 3 });
    expect(patientJourney(s, transfer(s, "cat-A")).next).toMatch(/no surgery has taken place/);
    const b = patientJourney(s, transfer(s, "cat-B"));
    expect(b).toMatchObject({ returned: true });
    expect(b.lookingAfter).toMatch(/Northgate Hospital Eye Service.*still looking after you/);
    expect(b.next).toMatch(/Nothing is chosen automatically/);
  });
});
