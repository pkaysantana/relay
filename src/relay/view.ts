/**
 * Read-only view models for the Lovable-derived screens (coordinator To-do, patient view).
 * Pure functions of the canonical engine state — this layer never authorises or changes anything.
 * It replaces the Lovable prototype's separate store and its provider-ranking / suitability logic,
 * which is deliberately NOT ported (Relay does not judge suitability or choose providers).
 */
import { isOverdue, organization, practitioner, transferBlockers } from "@/core/selectors";
import type { DemoState, TransferEpisode } from "@/core/types";
import { computePipeline } from "@/metrics/dashboard";
import { getPack } from "@/packs";

export interface TodoItem {
  id: string;
  transferId: string;
  patientName: string;
  nhsNumber: string;
  title: string;
  detail: string;
  /** Who currently holds the handover. */
  owner: string;
  overdue: boolean;
  dueLabel: string;
  button: string;
  href: string;
}

const hours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 3_600_000);

export function todoItems(state: DemoState): TodoItem[] {
  const p = computePipeline(state);
  const base = (t: TransferEpisode) => {
    const pt = state.patients.find((x) => x.id === t.patientId);
    return {
      transferId: t.id,
      patientName: pt?.displayName ?? t.patientId,
      nhsNumber: pt?.nhsNumber ?? "—",
      href: `/hub?t=${encodeURIComponent(t.id)}`,
    };
  };
  const sender = (t: TransferEpisode) =>
    `${practitioner(state, t.sendingPractitionerId)?.name ?? "Sending team"} (sending team)`;
  const items: TodoItem[] = [];

  for (const t of p.awaitingInformation) {
    const blockers = transferBlockers(state, t);
    items.push({
      ...base(t),
      id: `info-${t.id}`,
      title: "Handover awaiting information",
      detail: blockers.length
        ? `${blockers.length} item(s) to resolve before it can be sent: ${blockers.slice(0, 2).join("; ")}${blockers.length > 2 ? "…" : ""}`
        : `Receiver asked for clarification: ${t.clarificationQuestion ?? ""}`,
      owner: sender(t),
      overdue: false,
      dueLabel: "Not sent",
      button: "Review handover",
    });
  }
  for (const t of p.readyToSend) {
    items.push({
      ...base(t),
      id: `ready-${t.id}`,
      title: "Handover ready to sign off and send",
      detail: "All receiver-required information is present and confirmed.",
      owner: sender(t),
      overdue: false,
      dueLabel: "Not sent",
      button: "Open handover",
    });
  }
  for (const t of p.sentUnaccepted) {
    items.push({
      ...base(t),
      id: `sent-${t.id}`,
      title: "Handover not yet accepted",
      detail: `Sent to ${organization(state, t.receivingOrgId)?.name ?? "receiver"} ${hours(t.initiatedAt!, state.now)}h ago (demo clock). ${t.status === "received" ? "Receipt acknowledged; not accepted." : "Not yet acknowledged."}`,
      owner: `${sender(t)} — until a named receiving professional accepts`,
      overdue: false,
      dueLabel: "Awaiting response",
      button: "Open handover",
    });
  }
  for (const t of p.rejected) {
    items.push({
      ...base(t),
      id: `rejected-${t.id}`,
      title: "Returned by receiver",
      detail: `Reason: ${t.decisions.at(-1)?.reason ?? "not given"}`,
      owner: `${sender(t)} — responsibility stays with the sending team`,
      overdue: false,
      dueLabel: "Action needed",
      button: "Review",
    });
  }
  for (const x of p.awaitingAppointment) {
    const late = x.task.dueAt ? hours(x.task.dueAt, state.now) : 0;
    items.push({
      ...base(x.transfer),
      id: `booking-${x.transfer.id}`,
      title: x.overdue ? "Accepted — booking review deadline passed" : "Accepted — awaiting appointment booking",
      detail: x.overdue
        ? `No booking recorded. Synthetic review deadline passed ${late}h ago. Escalation contact: ${x.escalationContact?.name ?? "—"}.`
        : `Booking not yet recorded (booking is not treatment). Escalation contact: ${x.escalationContact?.name ?? "—"}.`,
      owner: `${practitioner(state, x.task.ownerPractitionerId)?.name ?? "Receiving provider"} (accepted the handover)`,
      overdue: x.overdue,
      dueLabel: x.overdue ? `Overdue by ${late}h` : "Open",
      button: x.overdue ? "Escalate" : "Open handover",
    });
  }
  return items.sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

export function todoTiles(state: DemoState) {
  const items = todoItems(state);
  return {
    overdue: items.filter((i) => i.overdue).length,
    needsAction: items.filter((i) => !i.overdue).length,
    completedWithEvidence: computePipeline(state).completedWithEvidence.length,
  };
}

/** Patient-facing journey. Fictional demonstration wording: no slots, no phone lines, no promised timescales. */
export const PATIENT_STEPS = [
  "Handover being prepared",
  "Sent — awaiting a response",
  "Accepted by the receiving provider",
  "Booking recorded (synthetic demonstration)",
] as const;

export interface PatientJourney {
  step: number;
  returned: boolean;
  lookingAfter: string;
  next: string;
}

export function patientJourney(state: DemoState, t: TransferEpisode): PatientJourney {
  const from = organization(state, t.sendingOrgId)?.name ?? "your current team";
  const to = organization(state, t.receivingOrgId)?.name ?? "the receiving provider";
  if (t.status === "rejected")
    return {
      step: 0,
      returned: true,
      lookingAfter: `${from} is still looking after you.`,
      next: `${to} was not able to accept this handover. Your current team will discuss the next step with you. Nothing is chosen automatically.`,
    };
  if (t.status === "sent" || t.status === "received")
    return {
      step: 1,
      returned: false,
      lookingAfter: `${from} is still looking after you until ${to} accepts.`,
      next: `Your information has been sent to ${to}. They have not accepted yet. This demonstration does not promise a response time.`,
    };
  if (t.status === "accepted") {
    const bookingIds = new Set(getPack(t.packId).taskTemplates.filter((x) => x.marksAppointmentBooked).map((x) => x.id));
    const tasks = state.tasks.filter((k) => k.transferId === t.id && bookingIds.has(k.templateId));
    const booked = tasks.some((k) => k.status === "completed");
    const overdue = tasks.some((k) => isOverdue(k, state.now));
    const named = practitioner(state, t.receivingPractitionerId)?.name;
    return {
      step: booked ? 3 : 2,
      returned: false,
      lookingAfter: `${to} has accepted your handover${named ? ` (named professional: ${named})` : ""}. The scope of clinical responsibility follows the local pathway and agreement.`,
      next: booked
        ? "A booking has been recorded in this synthetic demonstration. A booking is not treatment — no surgery has taken place."
        : `Booking not yet confirmed.${overdue ? " The team has been flagged to follow this up." : ""}`,
    };
  }
  return {
    step: 0,
    returned: false,
    lookingAfter: `${from} is looking after you.`,
    next: "Your current team is preparing and checking your information. Nothing has been sent yet.",
  };
}
