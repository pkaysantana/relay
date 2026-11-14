/**
 * Deterministic synthetic demo data. ALL people, organisations, identifiers and records are fictional.
 * Scenarios are built by running real commands through the engine (capture → confirm → sign off →
 * send → receive), so seeds can never contain a state the engine would not allow.
 *
 *  tr-A  complete handover → accepted → first contact completed with evidence   (P1-A, P2-A)
 *  tr-B  complete referral → rejected by the receiving service; unresolved      (P1-B, P2-D)
 *  tr-C  complete handover → accepted → no evidence by deadline (overdue)       (P1-C)
 *  tr-D  ambiguous/contradictory handover → unsent, awaiting sender confirmation (P2-C)
 *  Live walkthrough (P2-B): capture doc-5 in /hub, fix the missing field, send.
 */
import { applyAll, SYSTEM_ACTOR, type Command } from "@/core/engine";
import type { DemoState, TransferKind } from "@/core/types";
import { preparedDocument } from "@/data/documents";
import { parseLabelledDocument } from "@/extraction/labelledParser";
import { getPack, DEFAULT_PACK_ID } from "@/packs";
import { getReceiverProfile } from "@/packs/receivers";

export const DEMO_EPOCH = "2026-11-10T08:00:00.000Z";

const H = 3_600_000;
const at = (hoursFromEpoch: number) => new Date(Date.parse(DEMO_EPOCH) + hoursFromEpoch * H).toISOString();

function baseState(): DemoState {
  return {
    schemaVersion: 1,
    now: DEMO_EPOCH,
    nextId: 1,
    organizations: [
      { id: "org-acute", name: "Northgate General Hospital", type: "acute" },
      { id: "org-community", name: "Riverside Community Nursing", type: "community" },
      { id: "org-outpatient", name: "Hillside Specialist Outpatients", type: "specialist" },
      { id: "org-reablement", name: "Westfield Reablement Service", type: "social-care" },
      { id: "org-gp", name: "Elm Street Surgery", type: "primary-care" },
    ],
    practitioners: [
      { id: "prac-ward-1", name: "Dr Amara Lane", role: "discharging-clinician", orgId: "org-acute" },
      { id: "prac-ward-2", name: "Sam Reid (discharge coordinator)", role: "care-coordinator", orgId: "org-acute" },
      { id: "prac-cn-1", name: "Jo Mensah (community nurse)", role: "receiving-clinician", orgId: "org-community" },
      { id: "prac-cn-2", name: "Alex Kerr (community nurse lead)", role: "receiving-clinician", orgId: "org-community" },
      { id: "prac-op-1", name: "Dr Imran Patel (consultant)", role: "specialist-clinician", orgId: "org-outpatient" },
      { id: "prac-op-2", name: "Lee Cho (outpatient coordinator)", role: "care-coordinator", orgId: "org-outpatient" },
      { id: "prac-reab-1", name: "Chris Doyle (reablement lead)", role: "care-coordinator", orgId: "org-reablement" },
      { id: "prac-gp-1", name: "Dr Ruth Hale (GP)", role: "gp", orgId: "org-gp" },
    ],
    patients: [
      { id: "pat-1", syntheticId: "SYN-0001", displayName: "Synthetic Patient A", birthYear: 1948, nhsNumber: "999 000 0001", birthDate: "1948-03-12" },
      { id: "pat-2", syntheticId: "SYN-0002", displayName: "Synthetic Patient B", birthYear: 1955, nhsNumber: "999 000 0002", birthDate: "1955-07-30" },
      { id: "pat-3", syntheticId: "SYN-0003", displayName: "Synthetic Patient C", birthYear: 1939, nhsNumber: "999 000 0003", birthDate: "1939-11-02" },
      { id: "pat-4", syntheticId: "SYN-0004", displayName: "Synthetic Patient D", birthYear: 1961, nhsNumber: "999 000 0004", birthDate: "1961-01-19" },
      { id: "pat-5", syntheticId: "SYN-0005", displayName: "Synthetic Patient E", birthYear: 1972, nhsNumber: "999 000 0005", birthDate: "1972-05-08" },
    ],
    documents: [],
    transfers: [],
    tasks: [],
    events: [],
  };
}

/** Build a createHandover command from prepared documents via the deterministic parser. */
export function captureCommand(opts: {
  actorId: string;
  transferId?: string;
  patientId: string;
  sendingPractitionerId: string;
  transferKind: TransferKind;
  receiverProfileId: string;
  documentIds: string[];
}): Command {
  const documents = opts.documentIds.map((id) => {
    const d = preparedDocument(id);
    return { id: d.id, title: d.title, text: d.text };
  });
  const parsed = documents.map((d) => parseLabelledDocument({ ...d, addedAt: "" }));
  return {
    type: "createHandover",
    actorId: opts.actorId,
    transferId: opts.transferId,
    patientId: opts.patientId,
    sendingPractitionerId: opts.sendingPractitionerId,
    transferKind: opts.transferKind,
    receiverProfileId: opts.receiverProfileId,
    documents,
    extracted: parsed.flatMap((p) => p.fields),
    warnings: parsed.flatMap((p) => p.warnings),
  };
}

/** Deadlines = pack suggestion from now (the seed's stand-in for a clinician confirming them). */
export function suggestedDeadlines(state: DemoState, transferId: string): Record<string, string> {
  const t = state.transfers.find((x) => x.id === transferId)!;
  const pack = getPack(t.packId);
  const out: Record<string, string> = {};
  for (const k of state.tasks.filter((k) => k.transferId === transferId && k.status === "draft")) {
    const tpl = pack.taskTemplates.find((p) => p.id === k.templateId);
    out[k.id] = new Date(Date.parse(state.now) + (tpl?.suggestedDueHours ?? 72) * H).toISOString();
  }
  return out;
}

/** Commands for a named professional confirming the given fields (all extracted fields if omitted). */
export function confirmCommands(state: DemoState, transferId: string, actorId: string, keys?: string[]): Command[] {
  const t = state.transfers.find((x) => x.id === transferId)!;
  return (keys ?? Object.keys(t.handover!.fields)).map((key) => ({ type: "confirmHandoverField", actorId, transferId, key }));
}

function step(state: DemoState, cmd: Command | Command[] | ((s: DemoState) => Command | Command[])): DemoState {
  const c = typeof cmd === "function" ? cmd(state) : cmd;
  return applyAll(state, Array.isArray(c) ? c : [c]);
}

const clock = (hours: number): Command => ({ type: "advanceClock", actorId: SYSTEM_ACTOR, hours });

export function createSeedState(packId: string = DEFAULT_PACK_ID): DemoState {
  let s = baseState();
  const ward = "prac-ward-1";
  const gp = "prac-gp-1";

  const prepare = (id: string, patientId: string, sender: string, kind: TransferKind, profile: string, doc: string, signOff = true) => {
    s = step(s, { ...(captureCommand({ actorId: sender, transferId: id, patientId, sendingPractitionerId: sender, transferKind: kind, receiverProfileId: profile, documentIds: [doc] }) as Extract<Command, { type: "createHandover" }>), packId });
    if (!signOff) return;
    s = step(s, (st) => confirmCommands(st, id, sender));
    s = step(s, { type: "confirmSenderInfo", actorId: sender, transferId: id, fields: {} });
    s = step(s, { type: "generateHandover", actorId: sender, transferId: id });
  };
  const send = (id: string, sender: string) => (st: DemoState): Command => ({
    type: "sendTransfer",
    actorId: sender,
    transferId: id,
    receivingOrgId: getReceiverProfile(st.transfers.find((t) => t.id === id)!.handover!.receiverProfileId).orgId,
    deadlines: suggestedDeadlines(st, id),
  });

  // --- Day 0 morning: handovers captured, reviewed and signed off
  prepare("tr-A", "pat-1", ward, "discharge", "community-care", "doc-1");
  prepare("tr-B", "pat-2", gp, "referral", "specialist-outpatient", "doc-2");
  prepare("tr-C", "pat-3", ward, "discharge", "community-care", "doc-3");
  // P2-C: ambiguous/contradictory — only the clear fields are confirmed; it stays unsent.
  prepare("tr-D", "pat-4", ward, "discharge", "community-care", "doc-4", false);
  s = step(s, (st) =>
    confirmCommands(st, "tr-D", ward, ["patientId", "dateOfBirth", "sendingClinician", "careRequirements", "medications", "contactArrangement", "interpreterNeeded"]),
  );

  s = step(s, clock(2)); // 10:00
  s = step(s, send("tr-A", ward));
  s = step(s, send("tr-C", ward));
  s = step(s, clock(1)); // 11:00
  s = step(s, send("tr-B", gp));

  // --- Receiving teams respond
  s = step(s, clock(3)); // 14:00
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-A" });
  s = step(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-A", responsiblePractitionerId: "prac-cn-1" });
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-cn-2", transferId: "tr-C" });
  s = step(s, clock(2)); // 16:00
  s = step(s, { type: "acceptTransfer", actorId: "prac-cn-2", transferId: "tr-C", responsiblePractitionerId: "prac-cn-2" });
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-op-1", transferId: "tr-B" });
  s = step(s, {
    type: "rejectTransfer",
    actorId: "prac-op-1",
    transferId: "tr-B",
    reason: "Information is complete, but this clinic does not provide the requested assessment. Referrer to choose another service.",
  });

  // --- Day 1: tr-A first contact happens and is evidenced
  const taskOf = (st: DemoState, transferId: string, templateId: string) =>
    st.tasks.find((k) => k.transferId === transferId && k.templateId === templateId)!.id;
  s = step(s, clock(18)); // day 1, 10:00
  s = step(s, (st) => ({ type: "startTask", actorId: "prac-cn-1", taskId: taskOf(st, "tr-A", "first-contact") }));
  s = step(s, clock(4)); // 14:00
  s = step(s, (st) => ({
    type: "completeTask",
    actorId: "prac-cn-1",
    taskId: taskOf(st, "tr-A", "first-contact"),
    evidence: { summary: "Home visit completed. Synthetic contact note SYN-NOTE-0001 recorded.", kind: "contact-note", occurredAt: at(29) },
  }));
  s = step(s, (st) => ({ type: "scheduleTask", actorId: "prac-cn-1", taskId: taskOf(st, "tr-A", "agree-plan"), scheduledFor: at(80) }));

  // --- Day 3, 09:00 — tr-C first-contact deadline (day 2, 10:00) has passed with no evidence.
  s = step(s, clock(43));
  return s;
}

export const SCENARIO_LABELS: Record<string, string> = {
  "tr-A": "A — complete handover, accepted, first contact done",
  "tr-B": "B — complete referral rejected by receiver",
  "tr-C": "C — accepted, then overdue",
  "tr-D": "D — ambiguous / contradictory, awaiting sender",
};
