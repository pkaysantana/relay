/**
 * Cataract demonstration seed — NHS hospital eye service → NHS-funded independent provider.
 * Built by running real commands through the engine. Fictional people, organisations, dates.
 * Illustrative — pending clinician sign-off.
 *
 *  cat-A  complete → accepted → booking recorded (separate event); surgery NOT completed
 *  cat-B  complete, GA documented → rejected by provider (capability, human decision); sender keeps it
 *  cat-C  complete → accepted → synthetic booking-review deadline passes with no booking
 *  cat-D  two sources disagree on laterality → unsent, human must resolve
 *  Live (E): capture cdoc-E — laterality missing, agreement to alternative provider unconfirmed.
 */
import { applyAll, SYSTEM_ACTOR, type Command } from "@/core/engine";
import type { DemoState } from "@/core/types";
import { getReceiverProfile } from "@/packs/receivers";
import { captureCommand, confirmCommands, suggestedDeadlines } from "./seed";

export const CATARACT_EPOCH = "2026-11-09T09:00:00.000Z"; // Monday; demo "now" ends Sat 14 Nov 09:30


export const EYE_CONSULTANT = "prac-eye-1";
export const EYE_COORDINATOR = "prac-eye-2";
export const ISP_SURGEON = "prac-isp-1";
export const ISP_COORDINATOR = "prac-isp-2";

function baseState(): DemoState {
  return {
    schemaVersion: 1,
    now: CATARACT_EPOCH,
    nextId: 1,
    organizations: [
      { id: "org-eye", name: "Northgate Hospital Eye Service (NHS)", type: "acute" },
      { id: "org-isp", name: "Brookfield Eye Centre (independent sector, NHS-funded)", type: "independent" },
      { id: "org-westmoor", name: "Westmoor Hospital Ophthalmology (NHS)", type: "acute" },
    ],
    practitioners: [
      { id: EYE_CONSULTANT, name: "Mr Tomas Reyes (consultant ophthalmologist)", role: "ophthalmologist", orgId: "org-eye" },
      { id: EYE_COORDINATOR, name: "Priya Shah (elective pathway coordinator)", role: "pathway-coordinator", orgId: "org-eye" },
      { id: ISP_SURGEON, name: "Dr Helen Ward (ophthalmic surgeon)", role: "ophthalmic-surgeon", orgId: "org-isp" },
      { id: ISP_COORDINATOR, name: "Mark Boateng (patient pathway coordinator)", role: "receiving-coordinator", orgId: "org-isp" },
      { id: "prac-wm-1", name: "Ms Ana Silva (consultant ophthalmic surgeon)", role: "ophthalmic-surgeon", orgId: "org-westmoor" },
      { id: "prac-wm-2", name: "Tom Hughes (booking coordinator)", role: "receiving-coordinator", orgId: "org-westmoor" },
    ],
    patients: [
      { id: "pat-c1", syntheticId: "SYN-C001", displayName: "Synthetic Patient F", birthYear: 1951, nhsNumber: "999 100 0001", birthDate: "1951-06-04" },
      { id: "pat-c2", syntheticId: "SYN-C002", displayName: "Synthetic Patient G", birthYear: 1946, nhsNumber: "999 100 0002", birthDate: "1946-09-17" },
      { id: "pat-c3", syntheticId: "SYN-C003", displayName: "Synthetic Patient H", birthYear: 1958, nhsNumber: "999 100 0003", birthDate: "1958-01-22" },
      { id: "pat-c4", syntheticId: "SYN-C004", displayName: "Synthetic Patient J", birthYear: 1949, nhsNumber: "999 100 0004", birthDate: "1949-03-30" },
      { id: "pat-c5", syntheticId: "SYN-C005", displayName: "Synthetic Patient K", birthYear: 1953, nhsNumber: "999 100 0005", birthDate: "1953-12-12" },
    ],
    documents: [],
    transfers: [],
    tasks: [],
    events: [],
  };
}

export function createCataractSeedState(): DemoState {
  let s = baseState();
  const run = (c: Command | Command[] | ((st: DemoState) => Command | Command[])) => {
    const cmds = typeof c === "function" ? c(s) : c;
    s = applyAll(s, Array.isArray(cmds) ? cmds : [cmds]);
  };
  const capture = (id: string, patientId: string, documentIds: string[]) =>
    run(
      captureCommand({
        actorId: EYE_COORDINATOR, // the coordinator loads the documents
        transferId: id,
        patientId,
        sendingPractitionerId: EYE_CONSULTANT, // responsible professional
        transferKind: "provider-move",
        receiverProfileId: "independent-ophthalmology",
        documentIds,
      }),
    );
  const prepare = (id: string, patientId: string, doc: string) => {
    capture(id, patientId, [doc]);
    run((st) => confirmCommands(st, id, EYE_CONSULTANT)); // consultant reviews and confirms each field
    run({ type: "confirmSenderInfo", actorId: EYE_CONSULTANT, transferId: id, fields: {} });
    run({ type: "generateHandover", actorId: EYE_CONSULTANT, transferId: id });
  };
  const send = (id: string) =>
    run((st) => ({
      type: "sendTransfer",
      actorId: EYE_CONSULTANT,
      transferId: id,
      receivingOrgId: getReceiverProfile(st.transfers.find((t) => t.id === id)!.handover!.receiverProfileId).orgId,
      deadlines: suggestedDeadlines(st, id),
    }));
  const taskOf = (id: string, tpl: string) => s.tasks.find((k) => k.transferId === id && k.templateId === tpl)!.id;
  const clock = (hours: number) => run({ type: "advanceClock", actorId: SYSTEM_ACTOR, hours });

  // Mon 09:00 — packages prepared
  prepare("cat-A", "pat-c1", "cdoc-A");
  prepare("cat-B", "pat-c2", "cdoc-B");
  prepare("cat-C", "pat-c3", "cdoc-C");
  capture("cat-D", "pat-c4", ["cdoc-D1", "cdoc-D2"]);
  run((st) =>
    confirmCommands(st, "cat-D", EYE_CONSULTANT, Object.keys(st.transfers.find((t) => t.id === "cat-D")!.handover!.fields).filter((k) => k !== "laterality")),
  );

  clock(1); // Mon 10:00
  send("cat-A");
  send("cat-C");
  clock(4); // Mon 14:00
  run({ type: "acknowledgeTransfer", actorId: ISP_COORDINATOR, transferId: "cat-A" });
  run({ type: "acceptTransfer", actorId: ISP_SURGEON, transferId: "cat-A", responsiblePractitionerId: ISP_SURGEON });
  run({ type: "acknowledgeTransfer", actorId: ISP_COORDINATOR, transferId: "cat-C" });
  clock(2); // Mon 16:00
  run({ type: "acceptTransfer", actorId: ISP_SURGEON, transferId: "cat-C", responsiblePractitionerId: ISP_SURGEON });

  clock(18); // Tue 10:00
  send("cat-B");
  // cat-A: booking recorded as its own milestone; the surgery task stays open.
  run({ type: "startTask", actorId: ISP_COORDINATOR, taskId: taskOf("cat-A", "book-first-appointment") });
  run({
    type: "completeTask",
    actorId: ISP_COORDINATOR,
    taskId: taskOf("cat-A", "book-first-appointment"),
    evidence: {
      summary: "Pre-operative assessment booked for Fri 20 Nov 10:00 (simulated booking ref SIM-BK-0001). Booking only — no treatment has taken place.",
      kind: "document-ref",
    },
  });
  run({ type: "scheduleTask", actorId: ISP_COORDINATOR, taskId: taskOf("cat-A", "preop-assessment"), scheduledFor: "2026-11-20T10:00:00.000Z" });

  clock(4); // Tue 14:00
  run({ type: "acknowledgeTransfer", actorId: ISP_COORDINATOR, transferId: "cat-B" });
  run({
    type: "rejectTransfer",
    actorId: ISP_SURGEON,
    transferId: "cat-B",
    reason:
      "Information complete. The documented plan requires general anaesthesia; this site has no general anaesthesia facilities (synthetic capability). We cannot accept — the sending team should consider another clinically appropriate service.",
  });

  clock(91.5); // Sat 14 Nov 09:30 — cat-C booking review deadline (Fri 13 Nov 10:00) has passed
  return s;
}

export const CATARACT_SCENARIO_LABELS: Record<string, string> = {
  "cat-A": "A — accepted, booking recorded (surgery not done)",
  "cat-B": "B — rejected: anaesthetic capability mismatch",
  "cat-C": "C — accepted, no appointment by review deadline",
  "cat-D": "D — sources disagree on laterality",
};
