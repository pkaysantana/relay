/**
 * Deterministic synthetic demo data. ALL people, organisations and records are fictional.
 * Scenarios are built by running real commands through the engine, so seeds can never
 * contain a state the engine would not allow.
 *
 *  A — successful transfer: complete info, accepted, first contact completed with evidence
 *  B — failed handover: required info missing, receiving service rejects, unresolved
 *  C — overdue: accepted, no completion evidence by the deadline (escalate live in the demo)
 *  D — fresh draft for a live walkthrough
 */
import { applyAll, SYSTEM_ACTOR, type Command } from "@/core/engine";
import type { DemoState, TransferEpisode } from "@/core/types";
import { getPack, DEFAULT_PACK_ID } from "@/packs";

export const DEMO_EPOCH = "2026-11-10T08:00:00.000Z";

const H = 3_600_000;
const at = (hoursFromEpoch: number) => new Date(Date.parse(DEMO_EPOCH) + hoursFromEpoch * H).toISOString();

function baseState(packId: string): DemoState {
  const transfer = (
    id: string,
    patientId: string,
    fields: Record<string, string>,
    plannedDischargeAt: string,
  ): TransferEpisode => ({
    id,
    patientId,
    packId,
    sendingOrgId: "org-acute",
    sendingPractitionerId: "prac-ward-1",
    plannedDischargeAt,
    fields,
    status: "draft",
    decisions: [],
  });

  const complete = {
    episodeSummary: "Synthetic episode: 5-day inpatient stay. Treated and now medically optimised for discharge.",
    currentStatus: "Mobilising with one aid. Independent with personal care. Lives with partner.",
    actionsRequested: "Home visit to review recovery and confirm the care plan is working. Report concerns to the sending team.",
    patientInformed: "yes",
    queryContact: "Ward 7 discharge desk, ext. 0000 (synthetic)",
    accessNotes: "Key safe by front door. Code held by partner (synthetic).",
  };

  return {
    schemaVersion: 1,
    now: DEMO_EPOCH,
    nextId: 1,
    organizations: [
      { id: "org-acute", name: "Northgate General Hospital", type: "acute" },
      { id: "org-community", name: "Riverside Community Nursing", type: "community" },
      { id: "org-reablement", name: "Westfield Reablement Service", type: "social-care" },
      { id: "org-gp", name: "Elm Street Surgery", type: "primary-care" },
    ],
    practitioners: [
      { id: "prac-ward-1", name: "Dr Amara Lane", role: "discharging-clinician", orgId: "org-acute" },
      { id: "prac-ward-2", name: "Sam Reid (discharge coordinator)", role: "care-coordinator", orgId: "org-acute" },
      { id: "prac-cn-1", name: "Jo Mensah (community nurse)", role: "receiving-clinician", orgId: "org-community" },
      { id: "prac-cn-2", name: "Alex Kerr (community nurse lead)", role: "receiving-clinician", orgId: "org-community" },
      { id: "prac-reab-1", name: "Chris Doyle (reablement lead)", role: "care-coordinator", orgId: "org-reablement" },
      { id: "prac-gp-1", name: "Dr Ruth Hale (GP)", role: "gp", orgId: "org-gp" },
    ],
    patients: [
      { id: "pat-1", syntheticId: "SYN-0001", displayName: "Synthetic Patient A", birthYear: 1948 },
      { id: "pat-2", syntheticId: "SYN-0002", displayName: "Synthetic Patient B", birthYear: 1955 },
      { id: "pat-3", syntheticId: "SYN-0003", displayName: "Synthetic Patient C", birthYear: 1939 },
      { id: "pat-4", syntheticId: "SYN-0004", displayName: "Synthetic Patient D", birthYear: 1961 },
    ],
    transfers: [
      transfer("tr-A", "pat-1", complete, at(2)),
      transfer(
        "tr-B",
        "pat-2",
        {
          episodeSummary: "Synthetic episode: 3-day inpatient stay.",
          currentStatus: "Needs support with daily activities.",
          actionsRequested: "",
          patientInformed: "",
          queryContact: "",
        },
        at(3),
      ),
      transfer("tr-C", "pat-3", { ...complete, accessNotes: "" }, at(2)),
      transfer(
        "tr-D",
        "pat-4",
        {
          episodeSummary: "Synthetic episode: 2-day inpatient stay.",
          currentStatus: "Independent. Lives alone.",
          actionsRequested: "",
          patientInformed: "yes",
          queryContact: "Ward 3 discharge desk, ext. 0000 (synthetic)",
        },
        at(80),
      ),
    ],
    tasks: [],
    events: [],
  };
}

/** Task ids are deterministic: generateHandover allocates sequential ids from state.nextId. */
function deadlinesFor(state: DemoState, transferId: string): Record<string, string> {
  const t = state.transfers.find((x) => x.id === transferId)!;
  const pack = getPack(t.packId);
  const out: Record<string, string> = {};
  for (const k of state.tasks.filter((k) => k.transferId === transferId && k.status === "draft")) {
    const tpl = pack.taskTemplates.find((p) => p.id === k.templateId);
    out[k.id] = new Date(Date.parse(state.now) + (tpl?.suggestedDueHours ?? 72) * H).toISOString();
  }
  return out;
}

function step(state: DemoState, cmd: Command | ((s: DemoState) => Command)): DemoState {
  return applyAll(state, [typeof cmd === "function" ? cmd(state) : cmd]);
}

const clock = (hours: number): Command => ({ type: "advanceClock", actorId: SYSTEM_ACTOR, hours });

export function createSeedState(packId: string = DEFAULT_PACK_ID): DemoState {
  let s = baseState(packId);
  const sender = "prac-ward-1";
  const send = (transferId: string, receivingOrgId: string) => (st: DemoState): Command => ({
    type: "sendTransfer",
    actorId: sender,
    transferId,
    receivingOrgId,
    deadlines: deadlinesFor(st, transferId),
  });

  // --- Day 0 morning: A, B and C are prepared and sent
  for (const id of ["tr-A", "tr-B", "tr-C"]) {
    s = step(s, { type: "confirmSenderInfo", actorId: sender, transferId: id, fields: {} });
    s = step(s, { type: "generateHandover", actorId: sender, transferId: id });
  }
  s = step(s, clock(2)); // 10:00
  s = step(s, send("tr-A", "org-community"));
  s = step(s, send("tr-C", "org-community"));
  s = step(s, clock(1)); // 11:00
  s = step(s, send("tr-B", "org-reablement"));

  // --- Receiving teams respond
  s = step(s, clock(3)); // 14:00
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-cn-1", transferId: "tr-A" });
  s = step(s, { type: "acceptTransfer", actorId: "prac-cn-1", transferId: "tr-A", responsiblePractitionerId: "prac-cn-1" });
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-cn-2", transferId: "tr-C" });
  s = step(s, clock(2)); // 16:00
  s = step(s, { type: "acceptTransfer", actorId: "prac-cn-2", transferId: "tr-C", responsiblePractitionerId: "prac-cn-2" });
  s = step(s, { type: "acknowledgeTransfer", actorId: "prac-reab-1", transferId: "tr-B" });
  s = step(s, {
    type: "rejectTransfer",
    actorId: "prac-reab-1",
    transferId: "tr-B",
    reason: "Cannot accept: requested actions and query contact missing, and no reablement capacity this week.",
  });

  // --- Day 1: scenario A first contact happens and is evidenced
  const taskOf = (st: DemoState, transferId: string, templateId: string) =>
    st.tasks.find((k) => k.transferId === transferId && k.templateId === templateId)!.id;
  s = step(s, clock(18)); // day 1, 10:00
  s = step(s, (st) => ({ type: "startTask", actorId: "prac-cn-1", taskId: taskOf(st, "tr-A", "first-contact") }));
  s = step(s, clock(4)); // 14:00
  s = step(s, (st) => ({
    type: "completeTask",
    actorId: "prac-cn-1",
    taskId: taskOf(st, "tr-A", "first-contact"),
    evidence: {
      summary: "Home visit completed. Synthetic contact note SYN-NOTE-0001 recorded.",
      kind: "contact-note",
      occurredAt: at(29),
    },
  }));
  s = step(s, (st) => ({
    type: "scheduleTask",
    actorId: "prac-cn-1",
    taskId: taskOf(st, "tr-A", "agree-plan"),
    scheduledFor: at(80),
  }));

  // --- Scenario C: nothing recorded. Day 3, 09:00 — first contact deadline (day 2, 10:00) has passed.
  s = step(s, clock(43));
  return s;
}

export const SCENARIO_LABELS: Record<string, string> = {
  "tr-A": "Scenario A — successful transfer",
  "tr-B": "Scenario B — failed handover",
  "tr-C": "Scenario C — overdue action",
  "tr-D": "Live walkthrough — new draft",
};
