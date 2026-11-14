import { apply, applyAll, type Command } from "@/core/engine";
import type { DemoState } from "@/core/types";
import { captureCommand, confirmCommands, createSeedState, suggestedDeadlines } from "@/scenarios/seed";

export const seed = () => createSeedState();

export function ok(state: DemoState, cmd: Command | Command[]): DemoState {
  return applyAll(state, Array.isArray(cmd) ? cmd : [cmd]);
}

export function err(state: DemoState, cmd: Command): string {
  const r = apply(state, cmd);
  if (r.ok) throw new Error(`${cmd.type} unexpectedly succeeded`);
  return r.error;
}

export const task = (s: DemoState, transferId: string, templateId: string) =>
  s.tasks.find((k) => k.transferId === transferId && k.templateId === templateId)!;

export const transfer = (s: DemoState, id: string) => s.transfers.find((t) => t.id === id)!;

export const WARD = "prac-ward-1";

/** Capture doc-5 (Patient E) for community care as tr-E. Starts with missing/empty fields. */
export function capturedE(s: DemoState = seed(), documentIds = ["doc-5"]): DemoState {
  return ok(
    s,
    captureCommand({
      actorId: WARD,
      transferId: "tr-E",
      patientId: "pat-5",
      sendingPractitionerId: WARD,
      transferKind: "discharge",
      receiverProfileId: "community-care",
      documentIds,
    }),
  );
}

/** tr-E completed by the sender (manual entries), confirmed, signed off and generated. */
export function readyE(): DemoState {
  let s = capturedE();
  s = ok(s, [
    { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "allergies", value: "None known (checked with patient)" },
    { type: "updateHandoverField", actorId: WARD, transferId: "tr-E", key: "contactArrangement", value: "Patient, 01632 960005 (synthetic)" },
  ]);
  s = ok(s, confirmCommands(s, "tr-E", WARD));
  s = ok(s, [
    { type: "confirmSenderInfo", actorId: WARD, transferId: "tr-E", fields: {} },
    { type: "generateHandover", actorId: WARD, transferId: "tr-E" },
  ]);
  return s;
}

/** tr-E sent to community care and acknowledged (responsibility NOT accepted). */
export function receivedE(): DemoState {
  let s = readyE();
  s = ok(s, {
    type: "sendTransfer",
    actorId: WARD,
    transferId: "tr-E",
    receivingOrgId: "org-community",
    deadlines: suggestedDeadlines(s, "tr-E"),
  });
  return ok(s, { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-E" });
}
