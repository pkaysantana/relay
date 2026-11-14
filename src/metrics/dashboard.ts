/**
 * Operational measures computed from synthetic state/events.
 * DEMONSTRATION METRICS ONLY — not validated NHS impact estimates. No prediction, no risk scores.
 *
 * OWNER: evaluation & metrics.
 */
import { isOutstanding, isOverdue, transferBlockers } from "@/core/selectors";
import type { CareTask, DemoState, Practitioner, TransferEpisode } from "@/core/types";
import { getPack } from "@/packs";

export interface Ratio {
  numerator: number;
  denominator: number;
  /** null when denominator is 0 — show "—", never 0%. */
  pct: number | null;
}

export const NO_ACCEPTING_TEAM = "no-accepting-team";

const ratio = (n: number, d: number): Ratio => ({
  numerator: n,
  denominator: d,
  pct: d === 0 ? null : Math.round((n / d) * 100),
});

const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface DashboardMetrics {
  transfersInitiated: number;
  transfersAccepted: number;
  transfersUnresolved: number;
  tasksSent: number;
  tasksAccepted: Ratio;
  completedByDeadline: Ratio;
  unassignedTasks: CareTask[];
  rejectedTasks: CareTask[];
  overdueByTeam: { orgId: string; orgName: string; tasks: CareTask[] }[];
  hoursToAcceptance: { median: number | null; samples: number };
  hoursToFirstContact: { median: number | null; samples: number };
  packMeasures: { packId: string; id: string; label: string; description: string; result: Ratio }[];
  /** Required fields absent at capture (createHandover events), grouped by receiver profile and field. */
  missingAtCapture: { profileId: string; key: string; count: number }[];
  /** Handover transfers: submission (sendTransfer) → named-professional acceptance. */
  handoverToAcceptance: { median: number | null; samples: number };
  pipeline: Pipeline;
}

export interface Pipeline {
  /** Not sent; receiver-required information missing/unconfirmed, identity open, or clarification pending. */
  awaitingInformation: TransferEpisode[];
  /** Not sent; nothing blocking (still needs sign-off / deadlines / send). */
  readyToSend: TransferEpisode[];
  sentUnaccepted: TransferEpisode[];
  accepted: TransferEpisode[];
  rejected: TransferEpisode[];
  /** Accepted, but the appointment-booking milestone is not completed. Booking ≠ treatment. */
  awaitingAppointment: { transfer: TransferEpisode; task: CareTask; overdue: boolean; escalationContact?: Practitioner }[];
  /** Downstream actions completed WITH recorded evidence. */
  completedWithEvidence: CareTask[];
}

export function computePipeline(state: DemoState): Pipeline {
  const unsent = state.transfers.filter((t) => ["draft", "info-confirmed", "handover-ready", "clarification-requested"].includes(t.status));
  const blocked = (t: TransferEpisode) => t.status === "clarification-requested" || transferBlockers(state, t).length > 0;
  const awaitingAppointment = state.transfers
    .filter((t) => t.status === "accepted")
    .flatMap((t) => {
      const pack = getPack(t.packId);
      const bookingIds = new Set(pack.taskTemplates.filter((x) => x.marksAppointmentBooked).map((x) => x.id));
      const task = state.tasks.find((k) => k.transferId === t.id && bookingIds.has(k.templateId) && k.status !== "completed" && k.status !== "cancelled");
      if (!task) return [];
      const escalationContact =
        state.practitioners.find((p) => p.orgId === t.sendingOrgId && p.role === pack.escalationRole) ??
        state.practitioners.find((p) => p.id === t.sendingPractitionerId);
      return [{ transfer: t, task, overdue: isOverdue(task, state.now), escalationContact }];
    });
  return {
    awaitingInformation: unsent.filter(blocked),
    readyToSend: unsent.filter((t) => !blocked(t)),
    sentUnaccepted: state.transfers.filter((t) => t.status === "sent" || t.status === "received"),
    accepted: state.transfers.filter((t) => t.status === "accepted"),
    rejected: state.transfers.filter((t) => t.status === "rejected"),
    awaitingAppointment,
    completedWithEvidence: state.tasks.filter((k) => k.status === "completed" && !!k.evidence),
  };
}

function missingAtCapture(state: DemoState): DashboardMetrics["missingAtCapture"] {
  const counts = new Map<string, { profileId: string; key: string; count: number }>();
  for (const e of state.events) {
    if (e.type !== "createHandover") continue;
    const profileId = String(e.data?.receiverProfileId ?? "unknown");
    for (const key of (e.data?.missingRequired as string[] | undefined) ?? []) {
      const id = `${profileId}|${key}`;
      const row = counts.get(id) ?? { profileId, key, count: 0 };
      row.count += 1;
      counts.set(id, row);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function computeMetrics(state: DemoState): DashboardMetrics {
  const now = state.now;
  const initiated = state.transfers.filter((t) => t.initiatedAt);
  const sentTasks = state.tasks.filter((k) => k.status !== "draft");

  // % accepted: tasks that have ever been accepted by a named owner / tasks sent.
  const accepted = sentTasks.filter((k) => k.acceptedAt);

  // % completed by the agreed deadline, over tasks that are "due so far"
  // (deadline passed, or already completed). Tasks not yet due are excluded.
  const dueSoFar = sentTasks.filter(
    (k) => k.status !== "cancelled" && (k.status === "completed" || (k.dueAt && Date.parse(k.dueAt) <= Date.parse(now))),
  );
  const onTime = dueSoFar.filter(
    (k) => k.status === "completed" && k.completedAt && k.dueAt && Date.parse(k.completedAt) <= Date.parse(k.dueAt),
  );

  // A team is only "responsible" once a named owner accepted. Rejected/unaccepted overdue
  // tasks are grouped separately: the sending team still holds responsibility for them.
  const overdue = state.tasks.filter((k) => isOverdue(k, now));
  const byTeam = new Map<string, CareTask[]>();
  for (const k of overdue) {
    const key = k.ownerPractitionerId && k.ownerOrgId ? k.ownerOrgId : NO_ACCEPTING_TEAM;
    byTeam.set(key, [...(byTeam.get(key) ?? []), k]);
  }

  const toAcceptance = initiated
    .filter((t) => t.acceptedAt)
    .map((t) => hoursBetween(t.initiatedAt!, t.acceptedAt!));

  const toFirstContact = initiated.flatMap((t) => {
    const done = state.tasks
      .filter((k) => k.transferId === t.id && k.marksFirstCareContact && k.status === "completed" && k.completedAt)
      .map((k) => hoursBetween(t.initiatedAt!, k.completedAt!));
    return done.length ? [Math.min(...done)] : [];
  });

  const packIds = [...new Set(state.transfers.map((t) => t.packId))];
  const packMeasures = packIds.flatMap((packId) => {
    const pack = getPack(packId);
    const transfers = state.transfers.filter((t) => t.packId === packId);
    const ids = new Set(transfers.map((t) => t.id));
    const tasks = state.tasks.filter((k) => ids.has(k.transferId));
    return pack.qualityMeasures.map((m) => {
      const r = m.evaluate({ state, transfers, tasks });
      return {
        packId,
        id: m.id,
        label: m.label,
        description: m.description,
        result: ratio(r.numerator, r.denominator),
      };
    });
  });

  return {
    transfersInitiated: initiated.length,
    transfersAccepted: initiated.filter((t) => t.status === "accepted").length,
    transfersUnresolved: initiated.filter((t) =>
      ["sent", "received", "clarification-requested", "rejected"].includes(t.status),
    ).length,
    tasksSent: sentTasks.length,
    tasksAccepted: ratio(accepted.length, sentTasks.length),
    completedByDeadline: ratio(onTime.length, dueSoFar.length),
    unassignedTasks: sentTasks.filter(
      (k) => isOutstanding(k) && !k.ownerPractitionerId && k.status !== "rejected",
    ),
    rejectedTasks: sentTasks.filter((k) => k.status === "rejected"),
    overdueByTeam: [...byTeam.entries()].map(([orgId, tasks]) => ({
      orgId,
      orgName:
        state.organizations.find((o) => o.id === orgId)?.name ??
        "No accepting team (sending team retains responsibility)",
      tasks,
    })),
    hoursToAcceptance: { median: median(toAcceptance), samples: toAcceptance.length },
    hoursToFirstContact: { median: median(toFirstContact), samples: toFirstContact.length },
    packMeasures,
    missingAtCapture: missingAtCapture(state),
    pipeline: computePipeline(state),
    handoverToAcceptance: (() => {
      const xs = initiated
        .filter((t) => t.handover && t.acceptedAt)
        .map((t) => hoursBetween(t.initiatedAt!, t.acceptedAt!));
      return { median: median(xs), samples: xs.length };
    })(),
  };
}
