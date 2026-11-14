"use client";
import { organization, patient, practitioner, taskStatusLabel } from "@/core/selectors";
import type { CareTask, DemoState } from "@/core/types";
import { computeMetrics, type Ratio } from "@/metrics/dashboard";
import { useDemoState } from "@/state/store";
import { EventLog } from "@/components/EventLog";
import { fmt, hoursBetween } from "@/components/ui";

const pct = (r: Ratio) => (r.pct === null ? "—" : `${r.pct}%`);
const hrs = (h: number | null) => (h === null ? "—" : `${Math.round(h * 10) / 10} h`);

export default function Dashboard() {
  const state = useDemoState();
  const m = computeMetrics(state);

  const tiles = [
    { label: "Transfers initiated", value: String(m.transfersInitiated), detail: `${m.transfersAccepted} accepted · ${m.transfersUnresolved} unresolved` },
    { label: "Tasks accepted by a named owner", value: pct(m.tasksAccepted), detail: `${m.tasksAccepted.numerator} of ${m.tasksAccepted.denominator} sent` },
    { label: "Completed by agreed deadline", value: pct(m.completedByDeadline), detail: `${m.completedByDeadline.numerator} of ${m.completedByDeadline.denominator} due so far` },
    { label: "Unassigned tasks", value: String(m.unassignedTasks.length), detail: "sent, no named owner yet" },
    { label: "Rejected tasks", value: String(m.rejectedTasks.length), detail: "awaiting reassignment or cancellation" },
    { label: "Initiation → acceptance (median)", value: hrs(m.hoursToAcceptance.median), detail: `${m.hoursToAcceptance.samples} accepted transfer(s)` },
    { label: "Initiation → first care contact (median)", value: hrs(m.hoursToFirstContact.median), detail: `${m.hoursToFirstContact.samples} with recorded evidence` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Operational dashboard</h1>
        <p className="text-sm text-slate-600">
          Demonstration metrics computed from synthetic events at demo time {fmt(state.now)}. Not validated NHS impact estimates. No predictive or risk scoring.
        </p>
      </div>

      <section aria-label="Headline measures" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <div className="text-sm text-slate-700">{t.label}</div>
            <div className="text-3xl font-semibold tabular-nums mt-1">{t.value}</div>
            <div className="text-xs text-slate-600 mt-1">{t.detail}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Overdue tasks by responsible team</h2>
        {m.overdueByTeam.length === 0 ? (
          <p className="text-sm text-slate-600">No overdue tasks.</p>
        ) : (
          m.overdueByTeam.map((g) => (
            <div key={g.orgId} className="mb-4">
              <h3 className="font-medium">
                {g.orgName} <span className="text-sm text-slate-600">({g.tasks.length})</span>
              </h3>
              <TaskTable state={state} tasks={g.tasks} showOverdue />
            </div>
          ))
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <h2 className="font-semibold mb-2">Unassigned tasks</h2>
          <TaskTable state={state} tasks={m.unassignedTasks} />
        </section>
        <section className="card">
          <h2 className="font-semibold mb-2">Rejected tasks</h2>
          <TaskTable state={state} tasks={m.rejectedTasks} />
        </section>
      </div>

      {m.packMeasures.length > 0 && (
        <section className="card">
          <h2 className="font-semibold mb-2">Pathway pack quality measures</h2>
          <ul className="space-y-1 text-sm">
            {m.packMeasures.map((q) => (
              <li key={`${q.packId}-${q.id}`}>
                <strong>{q.label}</strong>: {pct(q.result)} ({q.result.numerator}/{q.result.denominator}){" "}
                <span className="text-slate-600">— {q.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EventLog state={state} limit={30} title="Recent events (all transfers)" />
    </div>
  );
}

function TaskTable({ state, tasks, showOverdue }: { state: DemoState; tasks: CareTask[]; showOverdue?: boolean }) {
  if (!tasks.length) return <p className="text-sm text-slate-600">None.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600 border-b">
            <th scope="col" className="py-1 pr-3">Patient</th>
            <th scope="col" className="py-1 pr-3">Action</th>
            <th scope="col" className="py-1 pr-3">Status</th>
            <th scope="col" className="py-1 pr-3">Due</th>
            <th scope="col" className="py-1 pr-3">Owner</th>
            <th scope="col" className="py-1 pr-3">Original responsibility</th>
            <th scope="col" className="py-1">Escalations</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((k) => {
            const t = state.transfers.find((x) => x.id === k.transferId)!;
            return (
              <tr key={k.id} className="border-b border-slate-100 align-top">
                <td className="py-1 pr-3 font-mono text-xs">{patient(state, t.patientId)?.syntheticId}</td>
                <td className="py-1 pr-3">{k.description}</td>
                <td className="py-1 pr-3">{taskStatusLabel(k)}</td>
                <td className="py-1 pr-3">
                  {fmt(k.dueAt)}
                  {showOverdue && k.dueAt && <strong className="block text-red-800">+{hoursBetween(k.dueAt, state.now)}h overdue</strong>}
                </td>
                <td className="py-1 pr-3">
                  {practitioner(state, k.ownerPractitionerId)?.name ?? <strong>No named owner</strong>}
                  <span className="block text-xs text-slate-600">{organization(state, k.ownerOrgId)?.name}</span>
                </td>
                <td className="py-1 pr-3">{practitioner(state, k.requesterPractitionerId)?.name}</td>
                <td className="py-1">{k.escalations.length || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
