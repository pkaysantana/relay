"use client";
import { practitioner } from "@/core/selectors";
import type { DemoState } from "@/core/types";
import { fmt } from "./ui";

/** Read-only view of the append-only event history. */
export function EventLog({
  state,
  transferId,
  limit = 40,
  title = "Event history",
}: {
  state: DemoState;
  transferId?: string;
  limit?: number;
  title?: string;
}) {
  const events = state.events
    .filter((e) => (transferId ? e.transferId === transferId : true))
    .slice(-limit)
    .reverse();
  const taskName = (id?: string) => state.tasks.find((t) => t.id === id)?.description;
  return (
    <section aria-label={title} className="card">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-xs text-slate-600 mb-2">Append-only. Newest first. Times are demo-clock times.</p>
      <ol className="space-y-1 text-sm max-h-96 overflow-auto">
        {events.map((e) => (
          <li key={e.id} className="border-b border-slate-100 pb-1">
            <span className="font-mono text-xs text-slate-500">
              #{e.seq} {fmt(e.at)}
            </span>{" "}
            <strong>{e.type}</strong>
            {e.fromStatus || e.toStatus ? ` ${e.fromStatus ?? "∅"} → ${e.toStatus ?? ""}` : ""}
            {e.taskId && <span className="text-slate-700"> · {taskName(e.taskId)}</span>}
            <span className="text-slate-600"> · {practitioner(state, e.actorId)?.name ?? e.actorId}</span>
            {e.note && <div className="text-slate-700 pl-4">“{e.note}”</div>}
          </li>
        ))}
        {events.length === 0 && <li className="text-slate-600">No events yet.</li>}
      </ol>
    </section>
  );
}
