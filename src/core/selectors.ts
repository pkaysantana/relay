/** Pure read-side helpers. Derived facts (overdue, needs-action) are computed, never stored. */
import type { CareTask, DemoState, TaskStatus, TransferEpisode } from "./types";
import { getPack } from "@/packs";
import { getReceiverProfile } from "@/packs/receivers";
import { validateHandover, type HandoverValidation } from "./validation";

export const TERMINAL_TASK_STATUSES: TaskStatus[] = ["completed", "cancelled"];

/** Sent to a receiving service and not yet resolved. Drafts are not outstanding. */
export function isOutstanding(task: CareTask): boolean {
  return task.status !== "draft" && !TERMINAL_TASK_STATUSES.includes(task.status);
}

/**
 * Overdue = has a deadline, deadline passed, still outstanding.
 * Distinct from FHIR status "failed" (an attempt was made and did not succeed).
 */
export function isOverdue(task: CareTask, now: string): boolean {
  return !!task.dueAt && isOutstanding(task) && Date.parse(now) > Date.parse(task.dueAt);
}

export function isUnassigned(task: CareTask): boolean {
  return isOutstanding(task) && !task.ownerPractitionerId;
}

export type AttentionReason = "rejected" | "failed" | "overdue" | "unassigned" | "blocked";

/** Why a task needs a human to act. Empty array = nothing pending. */
export function attentionReasons(task: CareTask, now: string): AttentionReason[] {
  const r: AttentionReason[] = [];
  if (task.status === "rejected") r.push("rejected");
  if (task.status === "failed") r.push("failed");
  if (isOverdue(task, now)) r.push("overdue");
  if (isUnassigned(task) && task.status !== "rejected" && task.status !== "failed")
    r.push("unassigned");
  if (task.blockers.some((b) => !b.resolvedAt)) r.push("blocked");
  return r;
}

export function missingRequiredFields(transfer: TransferEpisode): string[] {
  const pack = getPack(transfer.packId);
  return pack.requiredFields
    .filter((f) => !(transfer.fields[f.key] ?? "").trim())
    .map((f) => f.key);
}

/** Receiver validation for an evidence-aware handover (undefined for legacy pack-field transfers). */
export function handoverValidation(state: DemoState, t: TransferEpisode): HandoverValidation | undefined {
  if (!t.handover) return undefined;
  return validateHandover(
    t.handover,
    getReceiverProfile(t.handover.receiverProfileId),
    state.patients.find((p) => p.id === t.patientId),
    state.documents,
  );
}

/**
 * THE single guard used by the engine for sign-off, sending, clarification and acceptance.
 * Handover transfers: receiver-profile validation (fields + identity). Legacy: pack required fields.
 */
export function transferBlockers(state: DemoState, t: TransferEpisode): string[] {
  const v = handoverValidation(state, t);
  if (v) return v.blockingReasons;
  const pack = getPack(t.packId);
  return missingRequiredFields(t).map(
    (k) => `${pack.requiredFields.find((f) => f.key === k)?.label ?? k}: required information missing`,
  );
}

export function tasksForTransfer(state: DemoState, transferId: string): CareTask[] {
  return state.tasks.filter((t) => t.transferId === transferId);
}

export function practitioner(state: DemoState, id?: string) {
  return id ? state.practitioners.find((p) => p.id === id) : undefined;
}

export function organization(state: DemoState, id?: string) {
  return id ? state.organizations.find((o) => o.id === id) : undefined;
}

export function patient(state: DemoState, id: string) {
  return state.patients.find((p) => p.id === id);
}

/** Human label that never conflates scheduling/acceptance with completion. */
export function taskStatusLabel(task: CareTask): string {
  switch (task.status) {
    case "draft":
      return "Draft — not sent";
    case "requested":
      return "Requested — awaiting receipt";
    case "received":
      return "Received — not yet accepted";
    case "accepted":
      return task.scheduledFor ? "Accepted · scheduled (not done)" : "Accepted — not started";
    case "in-progress":
      return task.scheduledFor ? "In progress · scheduled (not done)" : "In progress — not done";
    case "on-hold":
      return "On hold — blocked";
    case "completed":
      return "Completed — evidence recorded";
    case "rejected":
      return "Rejected — needs reassignment";
    case "failed":
      return "Failed — needs action";
    case "cancelled":
      return "Cancelled";
  }
}

export function transferStatusLabel(t: TransferEpisode): string {
  switch (t.status) {
    case "draft":
      return t.handover ? "Draft — awaiting sender confirmation" : "Draft — sender reviewing";
    case "info-confirmed":
      return "Information confirmed by sender";
    case "handover-ready":
      return "Handover generated — deadlines to confirm";
    case "sent":
      return "Sent — not acknowledged";
    case "received":
      return "Acknowledged — responsibility NOT yet accepted";
    case "clarification-requested":
      return "Clarification requested — unresolved";
    case "accepted":
      return "Responsibility accepted";
    case "rejected":
      return "Rejected — unresolved";
  }
}
