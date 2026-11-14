/**
 * The core engine: a pure function (state, command) -> Result.
 * Every successful command appends at least one immutable DomainEvent.
 * Invalid commands return { ok: false, error } and never change state.
 *
 * Invariants (see tests/):
 *  - A transfer cannot be accepted without a named receiving professional and complete required info.
 *  - A task cannot be accepted without a named owner.
 *  - Nothing becomes "completed" except an in-progress task with recorded evidence.
 *  - Time passing never changes a status. Overdue is derived (selectors.isOverdue).
 *  - Rejected/failed tasks stay rejected/failed until someone reassigns or cancels them.
 *  - Escalation is recorded alongside, and never replaces, the original responsibility.
 *
 * OWNER: core model & state transitions.
 */
import { getPack } from "@/packs";
import { missingRequiredFields } from "./selectors";
import type {
  CareTask,
  DemoState,
  DomainEvent,
  Evidence,
  Id,
  ISODateTime,
  TaskStatus,
  TransferEpisode,
} from "./types";

export type Command =
  | { type: "advanceClock"; actorId: Id; hours: number }
  | { type: "confirmSenderInfo"; actorId: Id; transferId: Id; fields: Record<string, string> }
  | { type: "generateHandover"; actorId: Id; transferId: Id }
  | {
      type: "sendTransfer";
      actorId: Id;
      transferId: Id;
      receivingOrgId: Id;
      /** taskId -> ISO deadline confirmed by the actor. Every draft task needs one. */
      deadlines: Record<Id, ISODateTime>;
    }
  | { type: "acknowledgeTransfer"; actorId: Id; transferId: Id }
  | { type: "acceptTransfer"; actorId: Id; transferId: Id; responsiblePractitionerId?: Id }
  | { type: "rejectTransfer"; actorId: Id; transferId: Id; reason: string }
  | { type: "requestClarification"; actorId: Id; transferId: Id; question: string }
  | {
      type: "provideClarification";
      actorId: Id;
      transferId: Id;
      fields: Record<string, string>;
      note: string;
    }
  | { type: "redirectTransfer"; actorId: Id; transferId: Id; receivingOrgId: Id; note: string }
  | { type: "acknowledgeTask"; actorId: Id; taskId: Id }
  | { type: "acceptTask"; actorId: Id; taskId: Id; ownerPractitionerId?: Id }
  | { type: "rejectTask"; actorId: Id; taskId: Id; reason: string }
  | { type: "startTask"; actorId: Id; taskId: Id }
  | { type: "holdTask"; actorId: Id; taskId: Id; reason: string }
  | { type: "resumeTask"; actorId: Id; taskId: Id }
  | { type: "scheduleTask"; actorId: Id; taskId: Id; scheduledFor: ISODateTime }
  | {
      type: "completeTask";
      actorId: Id;
      taskId: Id;
      evidence: { summary: string; kind: Evidence["kind"]; occurredAt?: ISODateTime };
    }
  | { type: "failTask"; actorId: Id; taskId: Id; reason: string }
  | {
      type: "reassignTask";
      actorId: Id;
      taskId: Id;
      ownerOrgId: Id;
      ownerPractitionerId?: Id;
      reason: string;
    }
  | { type: "cancelTask"; actorId: Id; taskId: Id; reason: string }
  | {
      type: "escalateTask";
      actorId: Id;
      taskId: Id;
      note: string;
      escalateToPractitionerId?: Id;
    };

export type CommandType = Command["type"];

export type Result =
  | { ok: true; state: DemoState; events: DomainEvent[] }
  | { ok: false; error: string };

/** Allowed task status transitions. Anything not listed is refused. */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ["requested", "cancelled"],
  requested: ["received", "rejected", "cancelled"],
  received: ["accepted", "rejected", "cancelled"],
  // accepted/on-hold -> requested only via explicit reassignTask (new owner must accept again)
  accepted: ["in-progress", "on-hold", "rejected", "requested", "cancelled"],
  "in-progress": ["completed", "failed", "on-hold", "cancelled"],
  "on-hold": ["in-progress", "requested", "cancelled"],
  rejected: ["requested", "cancelled"],
  failed: ["requested", "cancelled"],
  completed: [],
  cancelled: [],
};

export const SYSTEM_ACTOR = "demo-operator";

class CommandError extends Error {}
const fail = (msg: string): never => {
  throw new CommandError(msg);
};

export function apply(state: DemoState, cmd: Command): Result {
  const next: DemoState = structuredClone(state);
  // History is immutable: re-freeze cloned events so accidental mutation throws at runtime.
  next.events.forEach((e) => Object.freeze(e));
  const before = next.events.length;
  try {
    run(next, cmd);
  } catch (e) {
    if (e instanceof CommandError) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, state: next, events: next.events.slice(before) };
}

/** Apply a sequence of commands; throws on the first failure (used for seeding and tests). */
export function applyAll(state: DemoState, cmds: Command[]): DemoState {
  return cmds.reduce((s, c) => {
    const r = apply(s, c);
    if (!r.ok) throw new Error(`${c.type} failed: ${r.error}`);
    return r.state;
  }, state);
}

// ---------------------------------------------------------------- internals

function newId(s: DemoState, prefix: string): Id {
  const id = `${prefix}-${String(s.nextId).padStart(4, "0")}`;
  s.nextId += 1;
  return id;
}

function emit(s: DemoState, e: Omit<DomainEvent, "seq" | "id" | "at">): DomainEvent {
  const event: DomainEvent = Object.freeze({
    ...e,
    seq: s.events.length + 1,
    id: newId(s, "evt"),
    at: s.now,
  }) as DomainEvent;
  s.events.push(event);
  return event;
}

function getTransfer(s: DemoState, id: Id): TransferEpisode {
  return s.transfers.find((t) => t.id === id) ?? fail(`Transfer ${id} not found`);
}

function getTask(s: DemoState, id: Id): CareTask {
  return s.tasks.find((t) => t.id === id) ?? fail(`Task ${id} not found`);
}

function actor(s: DemoState, id: Id) {
  if (id === SYSTEM_ACTOR) return undefined;
  return s.practitioners.find((p) => p.id === id) ?? fail(`Unknown actor ${id}`);
}

function requireActorInOrg(s: DemoState, actorId: Id, orgId: Id | undefined, what: string) {
  const a = actor(s, actorId);
  if (!a || !orgId || a.orgId !== orgId) fail(`Only staff at the ${what} organisation can do this`);
}

function requireText(v: string | undefined, what: string): string {
  const t = (v ?? "").trim();
  if (t.length < 3) fail(`${what} is required`);
  return t;
}

function requireTransferStatus(t: TransferEpisode, allowed: TransferEpisode["status"][]) {
  if (!allowed.includes(t.status))
    fail(`Transfer is "${t.status}"; this needs one of: ${allowed.join(", ")}`);
}

function moveTask(
  s: DemoState,
  task: CareTask,
  to: TaskStatus,
  actorId: Id,
  type: CommandType,
  extra: Partial<DomainEvent> = {},
): DomainEvent {
  if (!TASK_TRANSITIONS[task.status].includes(to))
    fail(`Task cannot move from "${task.status}" to "${to}"`);
  const from = task.status;
  task.status = to;
  return emit(s, {
    actorId,
    type,
    transferId: task.transferId,
    taskId: task.id,
    fromStatus: from,
    toStatus: to,
    ...extra,
  });
}

function setTransferStatus(
  s: DemoState,
  t: TransferEpisode,
  to: TransferEpisode["status"],
  actorId: Id,
  type: CommandType,
  extra: Partial<DomainEvent> = {},
) {
  const from = t.status;
  t.status = to;
  emit(s, { actorId, type, transferId: t.id, fromStatus: from, toStatus: to, ...extra });
}

function validDate(v: string | undefined, what: string): ISODateTime {
  if (!v || Number.isNaN(Date.parse(v))) fail(`${what} must be a valid date/time`);
  return new Date(v!).toISOString();
}

function run(s: DemoState, cmd: Command): void {
  switch (cmd.type) {
    case "advanceClock": {
      if (!(cmd.hours > 0 && cmd.hours <= 24 * 30)) fail("Clock can advance 0–720 hours");
      const from = s.now;
      s.now = new Date(Date.parse(s.now) + cmd.hours * 3_600_000).toISOString();
      emit(s, { actorId: cmd.actorId, type: cmd.type, note: `Demo clock ${from} → ${s.now}` });
      return;
    }

    case "confirmSenderInfo": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      requireTransferStatus(t, ["draft", "info-confirmed"]);
      t.fields = { ...t.fields, ...cmd.fields };
      t.senderConfirmedBy = cmd.actorId;
      t.senderConfirmedAt = s.now;
      setTransferStatus(s, t, "info-confirmed", cmd.actorId, cmd.type, {
        data: { missingFields: missingRequiredFields(t) },
      });
      return;
    }

    case "generateHandover": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      requireTransferStatus(t, ["info-confirmed"]);
      const pack = getPack(t.packId);
      for (const tpl of pack.taskTemplates) {
        const task: CareTask = {
          id: newId(s, "task"),
          transferId: t.id,
          templateId: tpl.id,
          description: tpl.label,
          ownerRole: tpl.ownerRole,
          requesterPractitionerId: t.sendingPractitionerId,
          timingNote: tpl.timingNote,
          marksFirstCareContact: !!tpl.marksFirstCareContact,
          status: "draft",
          blockers: [],
          escalations: [],
        };
        s.tasks.push(task);
        emit(s, {
          actorId: cmd.actorId,
          type: "taskCreated",
          transferId: t.id,
          taskId: task.id,
          toStatus: "draft",
          note: task.description,
        });
      }
      setTransferStatus(s, t, "handover-ready", cmd.actorId, cmd.type);
      return;
    }

    case "sendTransfer": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      requireTransferStatus(t, ["handover-ready"]);
      const org = s.organizations.find((o) => o.id === cmd.receivingOrgId);
      if (!org || org.id === t.sendingOrgId) fail("Choose a receiving organisation");
      const drafts = s.tasks.filter((k) => k.transferId === t.id && k.status === "draft");
      if (drafts.length === 0) fail("No actions to send");
      for (const k of drafts) {
        const due = validDate(cmd.deadlines[k.id], `Deadline for "${k.description}"`);
        if (Date.parse(due) <= Date.parse(s.now))
          fail(`Deadline for "${k.description}" must be in the future`);
        k.dueAt = due;
        k.dueConfirmedBy = cmd.actorId;
        k.ownerOrgId = org!.id;
        moveTask(s, k, "requested", cmd.actorId, cmd.type, {
          data: { dueAt: due, dueConfirmedBy: cmd.actorId, ownerOrgId: org!.id },
        });
      }
      t.receivingOrgId = org!.id;
      t.initiatedAt = s.now;
      setTransferStatus(s, t, "sent", cmd.actorId, cmd.type, {
        data: { receivingOrgId: org!.id, missingFields: missingRequiredFields(t) },
      });
      return;
    }

    case "acknowledgeTransfer": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.receivingOrgId, "receiving");
      requireTransferStatus(t, ["sent"]);
      t.acknowledgedAt = s.now;
      for (const k of s.tasks.filter((k) => k.transferId === t.id && k.status === "requested"))
        moveTask(s, k, "received", cmd.actorId, cmd.type);
      setTransferStatus(s, t, "received", cmd.actorId, cmd.type);
      return;
    }

    case "acceptTransfer": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.receivingOrgId, "receiving");
      requireTransferStatus(t, ["received"]);
      const missing = missingRequiredFields(t);
      if (missing.length) fail(`Cannot accept: required information missing (${missing.join(", ")})`);
      const resp = s.practitioners.find((p) => p.id === cmd.responsiblePractitionerId);
      if (!resp) fail("Cannot accept without naming the responsible professional");
      if (resp!.orgId !== t.receivingOrgId)
        fail("Responsible professional must belong to the receiving organisation");
      t.receivingPractitionerId = resp!.id;
      t.acceptedAt = s.now;
      t.decisions.push({ outcome: "accepted", by: cmd.actorId, at: s.now });
      for (const k of s.tasks.filter((k) => k.transferId === t.id && k.status === "received")) {
        k.ownerPractitionerId = resp!.id;
        k.acceptedAt = s.now;
        moveTask(s, k, "accepted", cmd.actorId, cmd.type, {
          data: { ownerPractitionerId: resp!.id },
        });
      }
      setTransferStatus(s, t, "accepted", cmd.actorId, cmd.type, {
        data: { responsiblePractitionerId: resp!.id },
      });
      return;
    }

    case "rejectTransfer": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.receivingOrgId, "receiving");
      requireTransferStatus(t, ["sent", "received", "clarification-requested"]);
      const reason = requireText(cmd.reason, "A reason for rejection");
      t.decisions.push({ outcome: "rejected", by: cmd.actorId, at: s.now, reason });
      for (const k of s.tasks.filter(
        (k) => k.transferId === t.id && ["requested", "received"].includes(k.status),
      )) {
        k.statusReason = reason;
        moveTask(s, k, "rejected", cmd.actorId, cmd.type, { note: reason });
      }
      setTransferStatus(s, t, "rejected", cmd.actorId, cmd.type, { note: reason });
      return;
    }

    case "requestClarification": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.receivingOrgId, "receiving");
      requireTransferStatus(t, ["sent", "received"]);
      const q = requireText(cmd.question, "A clarification question");
      t.clarificationQuestion = q;
      t.decisions.push({ outcome: "clarification-requested", by: cmd.actorId, at: s.now, reason: q });
      if (!t.acknowledgedAt) {
        t.acknowledgedAt = s.now;
        for (const k of s.tasks.filter((k) => k.transferId === t.id && k.status === "requested"))
          moveTask(s, k, "received", cmd.actorId, cmd.type);
      }
      setTransferStatus(s, t, "clarification-requested", cmd.actorId, cmd.type, { note: q });
      return;
    }

    case "provideClarification": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      requireTransferStatus(t, ["clarification-requested"]);
      const note = requireText(cmd.note, "A clarification note");
      t.fields = { ...t.fields, ...cmd.fields };
      t.clarificationQuestion = undefined;
      setTransferStatus(s, t, "received", cmd.actorId, cmd.type, {
        note,
        data: { missingFields: missingRequiredFields(t) },
      });
      return;
    }

    case "redirectTransfer": {
      const t = getTransfer(s, cmd.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      requireTransferStatus(t, ["rejected"]);
      const note = requireText(cmd.note, "A redirect note");
      const org = s.organizations.find((o) => o.id === cmd.receivingOrgId);
      if (!org || org.id === t.sendingOrgId) fail("Choose a receiving organisation");
      if (org!.id === t.receivingOrgId) fail("Choose a different organisation from the one that rejected");
      for (const k of s.tasks.filter((k) => k.transferId === t.id && k.status === "rejected")) {
        k.ownerOrgId = org!.id;
        k.ownerPractitionerId = undefined;
        k.statusReason = undefined;
        moveTask(s, k, "requested", cmd.actorId, cmd.type, {
          note,
          data: { ownerOrgId: org!.id },
        });
      }
      t.receivingOrgId = org!.id;
      t.receivingPractitionerId = undefined;
      t.acknowledgedAt = undefined;
      setTransferStatus(s, t, "sent", cmd.actorId, cmd.type, {
        note,
        data: { receivingOrgId: org!.id },
      });
      return;
    }

    case "acknowledgeTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "receiving");
      moveTask(s, k, "received", cmd.actorId, cmd.type);
      return;
    }

    case "acceptTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "receiving");
      const missing = missingRequiredFields(getTransfer(s, k.transferId));
      if (missing.length) fail(`Cannot accept: required information missing (${missing.join(", ")})`);
      const owner = s.practitioners.find((p) => p.id === cmd.ownerPractitionerId);
      if (!owner) fail("Cannot accept a task without naming its owner");
      if (owner!.orgId !== k.ownerOrgId) fail("Owner must belong to the receiving organisation");
      k.ownerPractitionerId = owner!.id;
      k.acceptedAt = s.now;
      moveTask(s, k, "accepted", cmd.actorId, cmd.type, { data: { ownerPractitionerId: owner!.id } });
      return;
    }

    case "rejectTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "receiving");
      const reason = requireText(cmd.reason, "A reason for rejection");
      k.statusReason = reason;
      moveTask(s, k, "rejected", cmd.actorId, cmd.type, { note: reason });
      return;
    }

    case "startTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      if (!k.ownerPractitionerId) fail("Task has no named owner");
      moveTask(s, k, "in-progress", cmd.actorId, cmd.type);
      return;
    }

    case "holdTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      const note = requireText(cmd.reason, "A blocker description");
      k.blockers.push({ id: newId(s, "blk"), note, raisedBy: cmd.actorId, raisedAt: s.now });
      k.statusReason = note;
      moveTask(s, k, "on-hold", cmd.actorId, cmd.type, { note });
      return;
    }

    case "resumeTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      for (const b of k.blockers) if (!b.resolvedAt) b.resolvedAt = s.now;
      k.statusReason = undefined;
      moveTask(s, k, "in-progress", cmd.actorId, cmd.type);
      return;
    }

    case "scheduleTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      if (!["accepted", "in-progress"].includes(k.status))
        fail("Only accepted or in-progress tasks can be scheduled");
      k.scheduledFor = validDate(cmd.scheduledFor, "Scheduled date");
      // Scheduling records intent only. Status is unchanged — it is not completion.
      emit(s, {
        actorId: cmd.actorId,
        type: cmd.type,
        transferId: k.transferId,
        taskId: k.id,
        note: `Scheduled for ${k.scheduledFor} (not completion)`,
        data: { scheduledFor: k.scheduledFor },
      });
      return;
    }

    case "completeTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      if (k.status !== "in-progress")
        fail(`Only an in-progress task can be completed (task is "${k.status}")`);
      const summary = requireText(cmd.evidence?.summary, "Evidence of completion");
      const occurredAt = cmd.evidence.occurredAt
        ? validDate(cmd.evidence.occurredAt, "Evidence date")
        : s.now;
      if (Date.parse(occurredAt) > Date.parse(s.now)) fail("Evidence cannot be dated in the future");
      const ev = moveTask(s, k, "completed", cmd.actorId, cmd.type, {
        note: summary,
        data: { evidence: { summary, kind: cmd.evidence.kind, occurredAt } },
      });
      k.completedAt = occurredAt;
      k.evidence = {
        summary,
        kind: cmd.evidence.kind,
        occurredAt,
        recordedAt: s.now,
        recordedBy: cmd.actorId,
        eventId: ev.id,
      };
      return;
    }

    case "failTask": {
      const k = getTask(s, cmd.taskId);
      requireActorInOrg(s, cmd.actorId, k.ownerOrgId, "owning");
      const reason = requireText(cmd.reason, "A reason");
      k.statusReason = reason;
      moveTask(s, k, "failed", cmd.actorId, cmd.type, { note: reason });
      return;
    }

    case "reassignTask": {
      const k = getTask(s, cmd.taskId);
      const t = getTransfer(s, k.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      const reason = requireText(cmd.reason, "A reason for reassignment");
      const org = s.organizations.find((o) => o.id === cmd.ownerOrgId) ?? fail("Unknown organisation");
      if (cmd.ownerPractitionerId) {
        const p = s.practitioners.find((x) => x.id === cmd.ownerPractitionerId);
        if (!p || p.orgId !== org.id) fail("Owner must belong to the chosen organisation");
      }
      const from = { ownerOrgId: k.ownerOrgId, ownerPractitionerId: k.ownerPractitionerId };
      k.ownerOrgId = org.id;
      k.ownerPractitionerId = undefined; // must be explicitly accepted again by the new owner
      k.statusReason = undefined;
      moveTask(s, k, "requested", cmd.actorId, cmd.type, {
        note: reason,
        data: { from, to: { ownerOrgId: org.id, proposedOwner: cmd.ownerPractitionerId } },
      });
      return;
    }

    case "cancelTask": {
      const k = getTask(s, cmd.taskId);
      const t = getTransfer(s, k.transferId);
      requireActorInOrg(s, cmd.actorId, t.sendingOrgId, "sending");
      const reason = requireText(cmd.reason, "A reason for cancellation");
      k.statusReason = reason;
      moveTask(s, k, "cancelled", cmd.actorId, cmd.type, { note: reason });
      return;
    }

    case "escalateTask": {
      const k = getTask(s, cmd.taskId);
      const t = getTransfer(s, k.transferId);
      const a = actor(s, cmd.actorId);
      if (!a || (a.orgId !== t.sendingOrgId && a.orgId !== k.ownerOrgId))
        fail("Only the sending or owning organisation can escalate");
      if (["draft", "completed", "cancelled"].includes(k.status)) fail("Nothing to escalate");
      const note = requireText(cmd.note, "An escalation note");
      if (cmd.escalateToPractitionerId && !s.practitioners.some((p) => p.id === cmd.escalateToPractitionerId))
        fail("Unknown escalation recipient");
      // Status and ownership deliberately unchanged: escalation is a record, not a resolution.
      const ev = emit(s, {
        actorId: cmd.actorId,
        type: cmd.type,
        transferId: k.transferId,
        taskId: k.id,
        note,
        data: { escalatedToPractitionerId: cmd.escalateToPractitionerId, statusAtEscalation: k.status },
      });
      k.escalations.push({
        id: ev.id,
        at: s.now,
        by: cmd.actorId,
        note,
        escalatedToPractitionerId: cmd.escalateToPractitionerId,
      });
      return;
    }
  }
}
