import { describe, expect, it } from "vitest";
import { applyAll, type Command } from "@/core/engine";
import { missingRequiredFields } from "@/core/selectors";
import { computeMetrics } from "@/metrics/dashboard";
import { listPacks } from "@/packs";
import { createSeedState } from "@/scenarios/seed";

describe("7. all configured pathway packs use the same core engine", () => {
  for (const pack of listPacks()) {
    it(`${pack.id}: full lifecycle runs through the shared engine`, () => {
      let s = createSeedState(pack.id);
      const fields = Object.fromEntries(pack.requiredFields.map((f) => [f.key, `Synthetic ${f.label}`]));
      s = applyAll(s, [
        { type: "confirmSenderInfo", actorId: "prac-ward-1", transferId: "tr-D", fields },
        { type: "generateHandover", actorId: "prac-ward-1", transferId: "tr-D" },
      ]);
      const draft = s.tasks.filter((k) => k.transferId === "tr-D");
      expect(draft.map((k) => k.templateId)).toEqual(pack.taskTemplates.map((t) => t.id));
      expect(missingRequiredFields(s.transfers.find((t) => t.id === "tr-D")!)).toEqual([]);

      const deadlines = Object.fromEntries(draft.map((k) => [k.id, new Date(Date.parse(s.now) + 24 * 3_600_000).toISOString()]));
      const first = draft[0].id;
      const cmds: Command[] = [
        { type: "sendTransfer", actorId: "prac-ward-1", transferId: "tr-D", receivingOrgId: "org-community", deadlines },
        { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-D" },
        { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-D", responsiblePractitionerId: "prac-cn-1" },
        { type: "startTask", actorId: "prac-cn-1", taskId: first },
        { type: "completeTask", actorId: "prac-cn-1", taskId: first, evidence: { summary: "Synthetic evidence", kind: "other" } },
      ];
      s = applyAll(s, cmds);
      expect(s.tasks.find((k) => k.id === first)!.status).toBe("completed");
      expect(() => computeMetrics(s)).not.toThrow();
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
