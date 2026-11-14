import { describe, expect, it } from "vitest";
import { applyAll, apply, type Command } from "@/core/engine";
import type { TransferEpisode } from "@/core/types";
import { computeMetrics } from "@/metrics/dashboard";
import { listPacks } from "@/packs";
import { captureCommand, confirmCommands, createSeedState, suggestedDeadlines } from "@/scenarios/seed";

describe("7. all configured pathway packs use the same core engine", () => {
  for (const pack of listPacks()) {
    it(`${pack.id}: handover lifecycle runs through the shared engine`, () => {
      let s = createSeedState(); // generic base; the pack under test is applied to the new transfer
      const capture = captureCommand({
        actorId: "prac-ward-1",
        transferId: "tr-P",
        patientId: "pat-1",
        sendingPractitionerId: "prac-ward-1",
        transferKind: "discharge",
        receiverProfileId: "community-care",
        documentIds: ["doc-1"],
      }) as Extract<Command, { type: "createHandover" }>;
      s = applyAll(s, [{ ...capture, packId: pack.id }]);
      s = applyAll(s, confirmCommands(s, "tr-P", "prac-ward-1"));
      s = applyAll(s, [
        { type: "confirmSenderInfo", actorId: "prac-ward-1", transferId: "tr-P", fields: {} },
        { type: "generateHandover", actorId: "prac-ward-1", transferId: "tr-P" },
      ]);
      const draft = s.tasks.filter((k) => k.transferId === "tr-P");
      expect(draft.map((k) => k.templateId)).toEqual(pack.taskTemplates.map((t) => t.id));
      const first = draft[0].id;
      s = applyAll(s, [
        { type: "sendTransfer", actorId: "prac-ward-1", transferId: "tr-P", receivingOrgId: "org-community", deadlines: suggestedDeadlines(s, "tr-P") },
        { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-P" },
        { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-P", responsiblePractitionerId: "prac-cn-1" },
        { type: "startTask", actorId: "prac-cn-1", taskId: first },
        { type: "completeTask", actorId: "prac-cn-1", taskId: first, evidence: { summary: "Synthetic evidence", kind: "other" } },
      ]);
      expect(s.tasks.find((k) => k.id === first)!.status).toBe("completed");
      expect(() => computeMetrics(s)).not.toThrow();
    });

    it(`${pack.id}: legacy pack-field transfers obey the same send rule`, () => {
      let s = createSeedState(); // generic base; the pack under test is applied to the new transfer
      const legacy: TransferEpisode = {
        id: "tr-L",
        patientId: "pat-5",
        packId: pack.id,
        sendingOrgId: "org-acute",
        sendingPractitionerId: "prac-ward-1",
        plannedDischargeAt: s.now,
        fields: {},
        status: "draft",
        decisions: [],
      };
      s = { ...s, transfers: [...s.transfers, legacy] };
      s = applyAll(s, [
        { type: "confirmSenderInfo", actorId: "prac-ward-1", transferId: "tr-L", fields: {} },
        { type: "generateHandover", actorId: "prac-ward-1", transferId: "tr-L" },
      ]);
      const r = apply(s, { type: "sendTransfer", actorId: "prac-ward-1", transferId: "tr-L", receivingOrgId: "org-community", deadlines: suggestedDeadlines(s, "tr-L") });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/Cannot send/);
    });

    it(`${pack.id}: templates reference declared roles and carry a timing note`, () => {
      const roles = new Set(pack.roles.map((r) => r.code));
      for (const t of pack.taskTemplates) {
        expect(roles.has(t.ownerRole)).toBe(true);
        expect(t.timingNote.length).toBeGreaterThan(0);
      }
    });
  }
});
