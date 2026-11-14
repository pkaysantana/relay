import { describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@/core/engine";
import { attentionReasons, isOutstanding, isOverdue } from "@/core/selectors";
import { computeMetrics, NO_ACCEPTING_TEAM } from "@/metrics/dashboard";
import { toFhirBundle } from "@/fhir/toFhir";
import { createSeedState } from "@/scenarios/seed";
import { err, ok, receivedD, seed, task, transfer } from "./helpers";

describe("1. missing responsibility is never silently treated as accepted", () => {
  it("refuses transfer acceptance without a named responsible professional", () => {
    const s = receivedD();
    expect(err(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D" })).toMatch(/responsible professional/);
    expect(transfer(s, "tr-D").status).toBe("received");
  });

  it("refuses a responsible professional from another organisation", () => {
    const s = receivedD();
    expect(
      err(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D", responsiblePractitionerId: "prac-gp-1" }),
    ).toMatch(/receiving organisation/);
  });

  it("refuses acceptance while required information is missing", () => {
    let s = seed();
    s = ok(s, { type: "redirectTransfer", actorId: "prac-ward-1", transferId: "tr-B", receivingOrgId: "org-community", note: "Redirecting to community nursing" });
    s = ok(s, { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-B" });
    expect(
      err(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-B", responsiblePractitionerId: "prac-cn-1" }),
    ).toMatch(/required information missing/);
  });

  it("acknowledgement is not acceptance, and tasks stay unassigned", () => {
    const s = receivedD();
    expect(transfer(s, "tr-D").status).toBe("received");
    for (const k of s.tasks.filter((k) => k.transferId === "tr-D")) {
      expect(k.status).toBe("received");
      expect(k.ownerPractitionerId).toBeUndefined();
      expect(attentionReasons(k, s.now)).toContain("unassigned");
    }
  });

  it("refuses task acceptance without a named owner", () => {
    const s = receivedD();
    const k = task(s, "tr-D", "first-contact");
    expect(err(s, { type: "acceptTask", actorId: "prac-cn-1", taskId: k.id })).toMatch(/owner/);
  });
});

describe("2. requested/accepted tasks cannot automatically become completed", () => {
  it("refuses completing a received or accepted task", () => {
    let s = receivedD();
    const id = task(s, "tr-D", "first-contact").id;
    const evidence = { summary: "Visit done", kind: "contact-note" as const };
    expect(err(s, { type: "completeTask", actorId: "prac-cn-1", taskId: id, evidence })).toMatch(/in-progress/);
    s = ok(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D", responsiblePractitionerId: "prac-cn-1" });
    expect(task(s, "tr-D", "first-contact").status).toBe("accepted");
    expect(err(s, { type: "completeTask", actorId: "prac-cn-1", taskId: id, evidence })).toMatch(/in-progress/);
  });

  it("scheduling and time passing do not complete a task", () => {
    let s = receivedD();
    s = ok(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D", responsiblePractitionerId: "prac-cn-1" });
    const id = task(s, "tr-D", "first-contact").id;
    s = ok(s, { type: "scheduleTask", actorId: "prac-cn-1", taskId: id, scheduledFor: s.now });
    s = ok(s, { type: "advanceClock", actorId: SYSTEM_ACTOR, hours: 200 });
    expect(task(s, "tr-D", "first-contact").status).toBe("accepted");
  });

  it("refuses completion without evidence", () => {
    let s = receivedD();
    s = ok(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D", responsiblePractitionerId: "prac-cn-1" });
    const id = task(s, "tr-D", "first-contact").id;
    s = ok(s, { type: "startTask", actorId: "prac-cn-1", taskId: id });
    expect(err(s, { type: "completeTask", actorId: "prac-cn-1", taskId: id, evidence: { summary: " ", kind: "other" } })).toMatch(/Evidence/);
  });
});

describe("3. overdue tasks remain outstanding until resolved", () => {
  it("scenario C first contact is overdue, still accepted, original responsibility visible", () => {
    const s = seed();
    const k = task(s, "tr-C", "first-contact");
    expect(k.status).toBe("accepted");
    expect(isOverdue(k, s.now)).toBe(true);
    expect(isOutstanding(k)).toBe(true);
    expect(k.requesterPractitionerId).toBe("prac-ward-1");
  });

  it("escalation is recorded but changes neither status nor owner", () => {
    let s = seed();
    const before = task(s, "tr-C", "first-contact");
    s = ok(s, { type: "escalateTask", actorId: "prac-ward-1", taskId: before.id, note: "No first contact recorded by deadline", escalateToPractitionerId: "prac-cn-2" });
    const after = task(s, "tr-C", "first-contact");
    expect(after.status).toBe(before.status);
    expect(after.ownerPractitionerId).toBe(before.ownerPractitionerId);
    expect(after.escalations).toHaveLength(1);
    expect(isOverdue(after, s.now)).toBe(true);
    expect(s.events.at(-1)!.type).toBe("escalateTask");
  });

  it("only completion with evidence clears overdue; late completion is counted as late", () => {
    let s = seed();
    const id = task(s, "tr-C", "first-contact").id;
    s = ok(s, { type: "startTask", actorId: "prac-cn-2", taskId: id });
    expect(isOverdue(task(s, "tr-C", "first-contact"), s.now)).toBe(true);
    s = ok(s, { type: "completeTask", actorId: "prac-cn-2", taskId: id, evidence: { summary: "Late home visit completed", kind: "contact-note" } });
    expect(isOverdue(task(s, "tr-C", "first-contact"), s.now)).toBe(false);
    const m = computeMetrics(s);
    expect(m.completedByDeadline.numerator).toBe(1); // only scenario A's on-time contact
  });
});

describe("4. rejected tasks require reassignment or another explicit action", () => {
  it("scenario B tasks are rejected and flagged", () => {
    const s = seed();
    expect(transfer(s, "tr-B").status).toBe("rejected");
    for (const k of s.tasks.filter((k) => k.transferId === "tr-B")) {
      expect(k.status).toBe("rejected");
      expect(attentionReasons(k, s.now)).toContain("rejected");
    }
  });

  it("rejected tasks cannot be started or completed, and stay rejected over time", () => {
    let s = seed();
    const id = task(s, "tr-B", "first-contact").id;
    expect(err(s, { type: "startTask", actorId: "prac-reab-1", taskId: id })).toBeTruthy();
    s = ok(s, { type: "advanceClock", actorId: SYSTEM_ACTOR, hours: 100 });
    expect(task(s, "tr-B", "first-contact").status).toBe("rejected");
  });

  it("reassignment returns the task to requested with no owner until re-accepted", () => {
    let s = seed();
    const id = task(s, "tr-B", "first-contact").id;
    expect(err(s, { type: "reassignTask", actorId: "prac-ward-1", taskId: id, ownerOrgId: "org-community", reason: "" })).toMatch(/reason/);
    s = ok(s, { type: "reassignTask", actorId: "prac-ward-1", taskId: id, ownerOrgId: "org-community", reason: "Community nursing has capacity" });
    const k = task(s, "tr-B", "first-contact");
    expect(k.status).toBe("requested");
    expect(k.ownerOrgId).toBe("org-community");
    expect(k.ownerPractitionerId).toBeUndefined();
  });

  it("cancellation is explicit and needs a reason", () => {
    let s = seed();
    const id = task(s, "tr-B", "agree-plan").id;
    s = ok(s, { type: "cancelTask", actorId: "prac-ward-1", taskId: id, reason: "Plan agreed before discharge" });
    expect(task(s, "tr-B", "agree-plan").status).toBe("cancelled");
  });
});

describe("5. recording completion preserves the supporting event", () => {
  it("evidence is stored on the task and in the immutable event log", () => {
    const s = seed();
    const k = task(s, "tr-A", "first-contact");
    expect(k.status).toBe("completed");
    const ev = s.events.find((e) => e.id === k.evidence!.eventId)!;
    expect(ev.type).toBe("completeTask");
    expect((ev.data!.evidence as { summary: string }).summary).toBe(k.evidence!.summary);
    expect(Object.isFrozen(ev)).toBe(true);
  });

  it("commands only append events; earlier events are unchanged", () => {
    const s0 = seed();
    const s1 = ok(s0, { type: "escalateTask", actorId: "prac-ward-1", taskId: task(s0, "tr-C", "first-contact").id, note: "Chasing" });
    expect(s1.events.slice(0, s0.events.length)).toEqual(s0.events);
    expect(s1.events.map((e) => e.seq)).toEqual(s1.events.map((_, i) => i + 1));
  });

  it("failed commands do not change state", () => {
    const s = seed();
    const snapshot = JSON.stringify(s);
    err(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-A" });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("evidence cannot be dated in the future", () => {
    let s = seed();
    const id = task(s, "tr-C", "first-contact").id;
    s = ok(s, { type: "startTask", actorId: "prac-cn-2", taskId: id });
    const future = new Date(Date.parse(s.now) + 3_600_000).toISOString();
    expect(err(s, { type: "completeTask", actorId: "prac-cn-2", taskId: id, evidence: { summary: "Visit", kind: "contact-note", occurredAt: future } })).toMatch(/future/);
  });
});

describe("6. resetting the demonstration restores known scenarios", () => {
  it("seed is deterministic", () => {
    expect(createSeedState()).toEqual(createSeedState());
  });

  it("known scenario states", () => {
    const s = createSeedState();
    expect(transfer(s, "tr-A").status).toBe("accepted");
    expect(task(s, "tr-A", "first-contact").status).toBe("completed");
    expect(transfer(s, "tr-B").status).toBe("rejected");
    expect(transfer(s, "tr-C").status).toBe("accepted");
    expect(isOverdue(task(s, "tr-C", "first-contact"), s.now)).toBe(true);
    expect(transfer(s, "tr-D").status).toBe("draft");
  });

  it("dashboard reflects the seeded workflow", () => {
    const m = computeMetrics(createSeedState());
    expect(m.transfersInitiated).toBe(3);
    expect(m.rejectedTasks).toHaveLength(3);
    const team = (id: string) => m.overdueByTeam.find((g) => g.orgId === id)?.tasks.map((k) => `${k.transferId}/${k.templateId}`);
    // C accepted by community nursing and overdue; B's rejected task is overdue but NOT charged to reablement.
    expect(team("org-community")).toEqual(["tr-C/first-contact"]);
    expect(team("org-reablement")).toBeUndefined();
    expect(team(NO_ACCEPTING_TEAM)).toEqual(["tr-B/first-contact"]);
    expect(m.hoursToFirstContact.samples).toBe(1);
    expect(m.hoursToAcceptance.samples).toBe(2);
    // due so far: A first contact (on time), C first contact (overdue), B first contact (rejected, overdue)
    expect(m.completedByDeadline).toMatchObject({ numerator: 1, denominator: 3 });
  });

  it("FHIR export marks overdue via businessStatus, not status=failed", () => {
    const s = createSeedState();
    const bundle = toFhirBundle(s, "tr-C") as { entry: { resource: Record<string, unknown> }[] };
    const t = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "Task" && r.description === task(s, "tr-C", "first-contact").description)!;
    expect(t.status).toBe("accepted");
    expect(t.businessStatus).toEqual({ text: "overdue" });
  });
});
