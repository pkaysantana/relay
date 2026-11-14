import { apply, applyAll, type Command } from "@/core/engine";
import type { DemoState } from "@/core/types";
import { createSeedState } from "@/scenarios/seed";

export const seed = () => createSeedState();

export function ok(state: DemoState, cmd: Command): DemoState {
  const r = apply(state, cmd);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
  return r.state;
}

export function err(state: DemoState, cmd: Command): string {
  const r = apply(state, cmd);
  if (r.ok) throw new Error(`${cmd.type} unexpectedly succeeded`);
  return r.error;
}

export const task = (s: DemoState, transferId: string, templateId: string) =>
  s.tasks.find((k) => k.transferId === transferId && k.templateId === templateId)!;

export const transfer = (s: DemoState, id: string) => s.transfers.find((t) => t.id === id)!;

/** Drive draft transfer tr-D (fields completed) through to "received" by the community team. */
export function receivedD(): DemoState {
  let s = seed();
  s = ok(s, {
    type: "confirmSenderInfo",
    actorId: "prac-ward-1",
    transferId: "tr-D",
    fields: { actionsRequested: "Review at home within agreed time." },
  });
  s = ok(s, { type: "generateHandover", actorId: "prac-ward-1", transferId: "tr-D" });
  const deadlines = Object.fromEntries(
    s.tasks
      .filter((k) => k.transferId === "tr-D")
      .map((k) => [k.id, new Date(Date.parse(s.now) + 48 * 3_600_000).toISOString()]),
  );
  s = applyAll(s, [
    { type: "sendTransfer", actorId: "prac-ward-1", transferId: "tr-D", receivingOrgId: "org-community", deadlines },
    { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-D" },
  ]);
  return s;
}
