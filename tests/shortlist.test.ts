/**
 * Provider shortlist — deterministic administrative decision support on FICTIONAL data.
 * These tests show the comparison behaves as specified; they are not evidence about real providers.
 */
import { describe, expect, it } from "vitest";
import { handoverValidation, transferBlockers } from "@/core/selectors";
import { preparedDocument } from "@/data/documents";
import {
  DOCUMENTED_REQUIREMENTS,
  PROVIDER_CATALOGUE,
  preferencesFor,
  requirementsFor,
} from "@/relay/providerCatalogue";
import { compareProviders, DEFAULT_SHORTLIST_CONFIG, proposeDestination, type SortMode } from "@/relay/shortlist";
import { createCataractSeedState, EYE_CONSULTANT, EYE_COORDINATOR } from "@/scenarios/cataract";
import { captureCommand, createSeedState } from "@/scenarios/seed";
import { err, ok, transfer } from "./helpers";

const K = "pat-c5"; // Case 1
const J = "pat-c4"; // Case 2
const G = "pat-c2"; // Case 3

const shortlist = (patientId: string, sort: SortMode = "score", over: Partial<NonNullable<ReturnType<typeof preferencesFor>>> = {}) =>
  compareProviders({
    patientId,
    preferences: { ...preferencesFor(patientId)!, ...over },
    requirements: requirementsFor(patientId),
    providers: PROVIDER_CATALOGUE,
    sort,
  });
const order = (s: ReturnType<typeof shortlist>) => s.entries.filter((e) => e.position !== null).map((e) => e.provider.id);
const entry = (s: ReturnType<typeof shortlist>, id: string) => s.entries.find((e) => e.provider.id === id)!;
const provider = (id: string) => PROVIDER_CATALOGUE.find((p) => p.id === id)!;

describe("Case 1 — wait versus distance", () => {
  it("a patient who prefers a shorter wait sees the shorter-wait provider first, with the trade-off explained", () => {
    const s = shortlist(K);
    expect(s.priorityUsed).toBe("shorter-wait");
    expect(order(s)).toEqual(["brookfield", "westmoor", "ashdown", "northgate"]);
    const b = entry(s, "brookfield");
    expect(b).toMatchObject({ position: 1, estimatedWaitWeeks: 6, distanceKm: 32, capacityUnconfirmed: true, score: 0.842 });
    expect(b.satisfied.join(" ")).toMatch(/Within the stated travel limit \(32 km ≤ 40 km\)/);
    expect(b.explanation).toMatch(/Appears first in this illustrative comparison/);
    expect(b.explanation).toMatch(/Actual capacity is unconfirmed/);
    // The shortest wait is NOT first: it is beyond the stated travel limit.
    const a = entry(s, "ashdown");
    expect(a.conflicts.join(" ")).toMatch(/Beyond the stated travel limit \(55 km > 40 km\)/);
    expect(a.missing.join(" ")).toMatch(/Written communication arrangements not declared/);
  });

  it("preference weights change the order (same patient, proximity preferred)", () => {
    expect(order(shortlist(K, "score", { priority: "closer" }))).toEqual(["westmoor", "northgate", "brookfield", "ashdown"]);
    expect(DEFAULT_SHORTLIST_CONFIG.weights["shorter-wait"].wait).toBeGreaterThan(DEFAULT_SHORTLIST_CONFIG.weights["closer"].wait);
    for (const w of Object.values(DEFAULT_SHORTLIST_CONFIG.weights)) expect(w.wait + w.distance + w.preferences).toBeCloseTo(1);
  });

  it("sorting by soonest or nearest is available and deterministic", () => {
    expect(order(shortlist(K, "soonest"))).toEqual(["ashdown", "brookfield", "westmoor", "northgate"]);
    expect(order(shortlist(K, "nearest"))).toEqual(["northgate", "westmoor", "brookfield", "ashdown"]);
  });

  it("ties are broken deterministically (score, then wait, then distance, then id) regardless of input order", () => {
    const s = shortlist(K);
    expect(entry(s, "ashdown").score).toBe(entry(s, "northgate").score); // exact tie at 0.5
    expect(entry(s, "ashdown").position).toBeLessThan(entry(s, "northgate").position!);
    const reversed = compareProviders({ patientId: K, preferences: preferencesFor(K)!, requirements: [], providers: [...PROVIDER_CATALOGUE].reverse() });
    expect(reversed.entries.map((e) => e.provider.id)).toEqual(s.entries.map((e) => e.provider.id));
    expect(JSON.stringify(shortlist(K))).toBe(JSON.stringify(shortlist(K)));
  });
});

describe("Case 2 — access requirements", () => {
  it("a limited travel range and transport need change the shortlist without any clinical judgement", () => {
    const s = shortlist(J);
    expect(order(s)).toEqual(["westmoor", "northgate", "brookfield", "ashdown"]);
    const b = entry(s, "brookfield");
    expect(b.group).toBe("compared"); // access conflicts lower the position; they do not exclude or judge eligibility
    expect(b.conflicts).toEqual(
      expect.arrayContaining([expect.stringMatching(/Beyond the stated travel limit \(22 km > 15 km\)/), expect.stringMatching(/needs transport; provider declares none/)]),
    );
    expect(b.satisfied.join(" ")).toMatch(/step-free access/);
    expect(entry(s, "westmoor").satisfied).toHaveLength(3);
    expect(s.entries.every((e) => e.clinicalReview.length === 0)).toBe(true);
  });
});

describe("Case 3 — clinical uncertainty", () => {
  it("a documented requirement the provider may not support is flagged for clinical review, not scored away", () => {
    const s = shortlist(G);
    const b = entry(s, "brookfield");
    expect(b.group).toBe("clinical-review");
    expect(b.position).toBeNull();
    expect(b.clinicalReview[0]).toMatch(/^Capability requires clinical review: General anaesthesia is documented for this patient; this provider declares it is not available on site\./);
    expect(b.explanation).toMatch(/A clinician must review.*it has not been excluded/);
    expect(order(s)).toEqual(["northgate", "westmoor"]);
    // Unknown capability is also a review question — never silently read as "no" or "yes".
    expect(entry(s, "ashdown").clinicalReview[0]).toMatch(/has not declared this capability/);
  });

  it("raising the weights can never position a provider with an open clinical-review flag", () => {
    const extreme = compareProviders({
      patientId: G,
      preferences: preferencesFor(G)!,
      requirements: requirementsFor(G),
      providers: PROVIDER_CATALOGUE,
      config: { weights: { ...DEFAULT_SHORTLIST_CONFIG.weights, balanced: { wait: 1, distance: 0, preferences: 0 } } },
    });
    expect(entry(extreme, "brookfield")).toMatchObject({ group: "clinical-review", position: null });
  });

  it("documented requirements are verbatim quotes from the synthetic record, not inferences", () => {
    for (const r of DOCUMENTED_REQUIREMENTS) expect(preparedDocument(r.documentId).text).toContain(r.quote);
    expect(requirementsFor(K)).toEqual([]); // nothing is derived from age, eyes, falls or medicines
  });
});

describe("missing, unknown and unconfirmed information", () => {
  it("unknown values stay unknown: missing distance or unavailable capacity means 'not compared', not zero", () => {
    const s = shortlist(G);
    expect(entry(s, "ashdown")).toMatchObject({ group: "not-compared", position: null, score: null, distanceKm: null });
    expect(entry(s, "ashdown").missing).toEqual(expect.arrayContaining(["Travel distance not available", "Transport provision not declared"]));
    expect(entry(s, "lakeside")).toMatchObject({ group: "not-compared", availability: "unavailable", score: null });
    expect(entry(s, "lakeside").missing).toContain("Estimated wait not available");
  });

  it("unconfirmed or unrecorded patient preferences are stated, and no travel limit is invented", () => {
    const s = shortlist(G);
    expect(s.preferencesConfirmed).toBe(false);
    expect(s.notes.join(" ")).toMatch(/not yet confirmed with the patient.*provisional/);
    expect(s.notes.join(" ")).toMatch(/balanced demonstration weights/);
    expect(s.notes.join(" ")).toMatch(/no travel limit applied/);
    expect(s.entries.every((e) => !e.conflicts.some((c) => /travel limit/.test(c)))).toBe(true);
    expect(shortlist(K).notes).toEqual([]);
  });

  it("never claims clinical suitability, a best provider, a guarantee or a recommendation", () => {
    const banned = /clinically suitable|best (medical )?provider|guarantee|recommended treatment|\brecommend/i;
    for (const p of [K, J, G])
      for (const sort of ["score", "soonest", "nearest"] as SortMode[])
        for (const e of shortlist(p, sort).entries)
          expect([e.explanation, ...e.factors, ...e.satisfied, ...e.conflicts, ...e.missing, ...e.clinicalReview].join(" ")).not.toMatch(banned);
  });
});

describe("selection is not consent, and the shortlist cannot bypass the engine", () => {
  it("comparison and proposal are read-only", () => {
    const s = createCataractSeedState();
    const before = JSON.stringify(s);
    for (const p of [K, J, G]) for (const pr of PROVIDER_CATALOGUE) proposeDestination(s, p, pr);
    shortlist(K);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("Case 1: proposing Brookfield only links to capture; the engine still requires agreement, confirmation and sign-off", () => {
    let s = createCataractSeedState();
    const proposal = proposeDestination(s, K, provider("brookfield"));
    expect(proposal).toMatchObject({ kind: "capture", href: "/hub?capture=1&patient=pat-c5&profile=independent-ophthalmology" });
    expect(proposal.note).toMatch(/not patient agreement/);
    expect(s.transfers.some((t) => t.patientId === K)).toBe(false); // nothing created by selecting

    // The coordinator then captures the handover through the normal workflow.
    s = ok(s, captureCommand({ actorId: EYE_COORDINATOR, transferId: "cat-E", patientId: K, sendingPractitionerId: EYE_CONSULTANT, transferKind: "provider-move", receiverProfileId: provider("brookfield").receiverProfileId!, documentIds: ["cdoc-E"] }));
    const t = transfer(s, "cat-E");
    expect(t.handover!.fields.providerTransferAgreement.confirmedBy).toBeUndefined(); // not auto-confirmed
    expect(Object.values(t.handover!.fields).every((f) => !f.confirmedBy)).toBe(true);
    expect(t.senderConfirmedBy).toBeUndefined();
    expect(transferBlockers(s, t).length).toBeGreaterThan(0);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} })).toMatch(/Cannot sign off/);

    // Existing safety rules still hold after arriving via the shortlist.
    expect(err(s, { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "treatmentPlan" })).toMatch(/must be confirmed by: ophthalmologist/);
    s = ok(s, [
      { type: "updateHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement", value: "declined" },
      { type: "confirmHandoverField", actorId: EYE_COORDINATOR, transferId: "cat-E", key: "providerTransferAgreement" },
    ]);
    expect(handoverValidation(s, transfer(s, "cat-E"))!.blockingReasons.join(" ")).toMatch(/Patient declined/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_COORDINATOR, transferId: "cat-E", fields: {} })).toMatch(/needs one of these roles: ophthalmologist/);
    expect(err(s, { type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: "cat-E", fields: {} })).toMatch(/declined/i);
  });

  it("Case 3: a returned handover is never re-sent automatically; redirecting stays an explicit step", () => {
    const s = createCataractSeedState();
    const toWestmoor = proposeDestination(s, G, provider("westmoor"));
    expect(toWestmoor).toMatchObject({ kind: "redirect-existing", href: "/hub?t=cat-B&profile=nhs-ophthalmology" });
    expect(toWestmoor.note).toMatch(/never re-sends automatically/);
    const again = proposeDestination(s, G, provider("brookfield"));
    expect(again.kind).toBe("open-existing");
    expect(again.note).toMatch(/already returned.*general anaesthesia/i);
    expect(transfer(s, "cat-B")).toMatchObject({ status: "rejected", receivingOrgId: "org-isp", sendingPractitionerId: EYE_CONSULTANT });
  });

  it("providers without a receiver profile, the current provider, and other demo sets are informational only", () => {
    const s = createCataractSeedState();
    expect(proposeDestination(s, K, provider("ashdown")).kind).toBe("informational");
    expect(proposeDestination(s, K, provider("ashdown")).href).toBeUndefined();
    expect(proposeDestination(s, K, provider("northgate")).kind).toBe("current");
    expect(proposeDestination(s, K, provider("northgate")).href).toBeUndefined();
    expect(proposeDestination(createSeedState(), K, provider("brookfield")).kind).toBe("informational"); // org not in the generic demo
    // A handover in progress to another provider cannot be re-pointed from the shortlist.
    expect(proposeDestination(s, J, provider("westmoor")).note).toMatch(/destination cannot be changed from this screen/);
  });
});
