"use client";
import { useId, useState } from "react";
import { attentionReasons, organization, practitioner, taskStatusLabel } from "@/core/selectors";
import type { CareTask, DemoState, Evidence } from "@/core/types";
import { useCommand } from "@/state/store";
import {
  AttentionBadges,
  ErrorAlert,
  fmt,
  fromInput,
  hoursBetween,
  Select,
  TaskStatusBadge,
  TextAction,
  toInput,
} from "./ui";

type Side = "sender" | "receiver";

export function TaskCard({
  task,
  state,
  side,
  actorId,
}: {
  task: CareTask;
  state: DemoState;
  side: Side;
  actorId: string;
}) {
  const { run, error } = useCommand();
  const reasons = attentionReasons(task, state.now);
  const owner = practitioner(state, task.ownerPractitionerId);
  const ownerOrg = organization(state, task.ownerOrgId);
  const requester = practitioner(state, task.requesterPractitionerId);
  const overdueBy = reasons.includes("overdue") && task.dueAt ? hoursBetween(task.dueAt, state.now) : 0;

  return (
    <li className={`card ${reasons.some((r) => r !== "unassigned") ? "border-l-4 border-l-red-700" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-medium">{task.description}</h4>
        <div className="flex flex-wrap gap-1">
          <TaskStatusBadge status={task.status} label={taskStatusLabel(task)} />
          <AttentionBadges reasons={reasons} />
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-600">Owner</dt>
        <dd>
          {owner ? owner.name : <strong>No named owner</strong>}
          {ownerOrg ? ` · ${ownerOrg.name}` : ""}
        </dd>
        <dt className="text-slate-600">Original responsibility</dt>
        <dd>{requester?.name ?? "—"} (sending team)</dd>
        <dt className="text-slate-600">Deadline</dt>
        <dd>
          {fmt(task.dueAt)}
          {overdueBy > 0 && <strong className="text-red-800"> — overdue by {overdueBy}h</strong>}
          {task.dueConfirmedBy && (
            <span className="text-slate-600"> · confirmed by {practitioner(state, task.dueConfirmedBy)?.name}</span>
          )}
        </dd>
        {task.scheduledFor && task.status !== "completed" && (
          <>
            <dt className="text-slate-600">Scheduled (not completion)</dt>
            <dd>{fmt(task.scheduledFor)}</dd>
          </>
        )}
        {task.statusReason && (
          <>
            <dt className="text-slate-600">Reason</dt>
            <dd>{task.statusReason}</dd>
          </>
        )}
      </dl>

      {task.evidence && (
        <p className="mt-2 rounded bg-green-50 px-2 py-1 text-sm text-green-950">
          <strong>Evidence ({task.evidence.kind}):</strong> {task.evidence.summary} — occurred {fmt(task.evidence.occurredAt)}, recorded by{" "}
          {practitioner(state, task.evidence.recordedBy)?.name} (event {task.evidence.eventId})
        </p>
      )}
      {task.blockers.filter((b) => !b.resolvedAt).map((b) => (
        <p key={b.id} className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-950">
          <strong>Blocker:</strong> {b.note}
        </p>
      ))}
      {task.escalations.map((e) => (
        <p key={e.id} className="mt-2 rounded bg-orange-50 px-2 py-1 text-sm text-orange-950">
          <strong>Escalated {fmt(e.at)}</strong> by {practitioner(state, e.by)?.name}
          {e.escalatedToPractitionerId && ` to ${practitioner(state, e.escalatedToPractitionerId)?.name}`}: {e.note}
        </p>
      ))}

      <div className="mt-3 flex flex-wrap gap-2">
        {side === "receiver" ? (
          <ReceiverActions task={task} state={state} actorId={actorId} run={run} />
        ) : (
          <SenderActions task={task} state={state} actorId={actorId} run={run} />
        )}
      </div>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{task.timingNote}</p>
    </li>
  );
}

type Run = ReturnType<typeof useCommand>["run"];
interface ActionProps {
  task: CareTask;
  state: DemoState;
  actorId: string;
  run: Run;
}

function SenderActions({ task, state, actorId, run }: ActionProps) {
  const [org, setOrg] = useState("");
  const transfer = state.transfers.find((t) => t.id === task.transferId)!;
  const canEscalate = !["draft", "completed", "cancelled"].includes(task.status);
  const needsReassign = ["rejected", "failed", "accepted", "on-hold"].includes(task.status);
  return (
    <>
      {canEscalate && (
        <TextAction
          label="Escalate"
          fieldLabel="Escalation note (recorded; does not change responsibility)"
          variant="danger"
          onSubmit={(note) =>
            run({
              type: "escalateTask",
              actorId,
              taskId: task.id,
              note,
              escalateToPractitionerId: task.ownerPractitionerId,
            })
          }
        />
      )}
      {needsReassign && (
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Reassign to"
            value={org}
            onChange={setOrg}
            placeholder="— choose organisation —"
            options={state.organizations
              .filter((o) => o.id !== transfer.sendingOrgId)
              .map((o) => ({ value: o.id, label: o.name }))}
          />
          {org && (
            <TextAction
              label="Reassign"
              fieldLabel="Reason for reassignment"
              onSubmit={(reason) => run({ type: "reassignTask", actorId, taskId: task.id, ownerOrgId: org, reason })}
            />
          )}
        </div>
      )}
      {!["completed", "cancelled", "draft"].includes(task.status) && (
        <TextAction
          label="Cancel action"
          fieldLabel="Reason for cancelling"
          onSubmit={(reason) => run({ type: "cancelTask", actorId, taskId: task.id, reason })}
        />
      )}
    </>
  );
}

function ReceiverActions({ task, state, actorId, run }: ActionProps) {
  const [owner, setOwner] = useState("");
  const orgStaff = state.practitioners.filter((p) => p.orgId === task.ownerOrgId);
  switch (task.status) {
    case "requested":
      return (
        <>
          <button className="btn-secondary" onClick={() => run({ type: "acknowledgeTask", actorId, taskId: task.id })}>
            Acknowledge receipt
          </button>
          <TextAction label="Reject" fieldLabel="Reason for rejection" variant="danger" onSubmit={(reason) => run({ type: "rejectTask", actorId, taskId: task.id, reason })} />
        </>
      );
    case "received":
      return (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Named owner (required)"
              value={owner}
              onChange={setOwner}
              placeholder="— choose —"
              options={orgStaff.map((p) => ({ value: p.id, label: p.name }))}
            />
            <button
              className="btn-primary"
              onClick={() => run({ type: "acceptTask", actorId, taskId: task.id, ownerPractitionerId: owner || undefined })}
            >
              Accept responsibility
            </button>
          </div>
          <TextAction label="Reject" fieldLabel="Reason for rejection" variant="danger" onSubmit={(reason) => run({ type: "rejectTask", actorId, taskId: task.id, reason })} />
        </>
      );
    case "accepted":
      return (
        <>
          <button className="btn-primary" onClick={() => run({ type: "startTask", actorId, taskId: task.id })}>
            Start
          </button>
          <ScheduleAction task={task} actorId={actorId} run={run} />
          <TextAction label="Put on hold" fieldLabel="What is blocking this?" onSubmit={(reason) => run({ type: "holdTask", actorId, taskId: task.id, reason })} />
          <TextAction label="Hand back (reject)" fieldLabel="Reason" variant="danger" onSubmit={(reason) => run({ type: "rejectTask", actorId, taskId: task.id, reason })} />
        </>
      );
    case "in-progress":
      return (
        <>
          <CompleteAction task={task} state={state} actorId={actorId} run={run} />
          <ScheduleAction task={task} actorId={actorId} run={run} />
          <TextAction label="Put on hold" fieldLabel="What is blocking this?" onSubmit={(reason) => run({ type: "holdTask", actorId, taskId: task.id, reason })} />
          <TextAction label="Record failed attempt" fieldLabel="What happened?" variant="danger" onSubmit={(reason) => run({ type: "failTask", actorId, taskId: task.id, reason })} />
        </>
      );
    case "on-hold":
      return (
        <button className="btn-primary" onClick={() => run({ type: "resumeTask", actorId, taskId: task.id })}>
          Resolve blocker & resume
        </button>
      );
    default:
      return null;
  }
}

function ScheduleAction({ task, actorId, run }: Omit<ActionProps, "state">) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(toInput(task.scheduledFor));
  if (!open)
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        {task.scheduledFor ? "Reschedule" : "Schedule"}
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (run({ type: "scheduleTask", actorId, taskId: task.id, scheduledFor: fromInput(when) })) setOpen(false);
      }}
    >
      <div>
        <label htmlFor={id} className="label">
          Planned date/time (UTC) — scheduling is not completion
        </label>
        <input id={id} type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <button className="btn-primary" type="submit">
        Save
      </button>
      <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function CompleteAction({ task, state, actorId, run }: ActionProps) {
  const ids = { s: useId(), k: useId(), d: useId() };
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<Evidence["kind"]>("contact-note");
  const [when, setWhen] = useState(toInput(state.now));
  if (!open)
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Record completion…
      </button>
    );
  return (
    <form
      className="w-full space-y-2 rounded border border-green-300 bg-green-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (run({ type: "completeTask", actorId, taskId: task.id, evidence: { summary, kind, occurredAt: fromInput(when) } }))
          setOpen(false);
      }}
    >
      <p className="text-sm font-medium">Completion requires evidence. It is preserved in the event log.</p>
      <div>
        <label htmlFor={ids.s} className="label">
          Evidence summary (synthetic)
        </label>
        <textarea id={ids.s} className="input" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor={ids.k} className="label">
            Evidence type
          </label>
          <select id={ids.k} className="input" value={kind} onChange={(e) => setKind(e.target.value as Evidence["kind"])}>
            <option value="contact-note">Contact note</option>
            <option value="observation">Observation</option>
            <option value="document-ref">Document reference</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor={ids.d} className="label">
            When it happened (UTC)
          </label>
          <input id={ids.d} type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          Record completion
        </button>
        <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
