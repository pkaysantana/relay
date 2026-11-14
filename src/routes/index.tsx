import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/relay/bits";
import { tileCounts } from "@/lib/relay/logic";
import { useRelay } from "@/lib/relay/store";
import type { TaskType } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "To do – Relay" },
      { name: "description", content: "Relay coordinator queue: long waits, handovers and missed appointments for cataract patients." },
      { property: "og:title", content: "To do – Relay" },
      { property: "og:description", content: "Move long-waiting cataract patients to a faster suitable provider." },
    ],
  }),
  component: TodoPage,
});

const META: Record<TaskType, { title: string; button: string }> = {
  longWait: { title: "Long wait – faster suitable provider available", button: "Find provider" },
  handover: { title: "Handover not accepted", button: "Chase" },
  missed: { title: "Missed appointment", button: "Rebook" },
  returned: { title: "Returned by receiver", button: "Review" },
};
const FILTERS: { label: string; types: TaskType[] | null }[] = [
  { label: "All", types: null },
  { label: "Long waits", types: ["longWait", "returned"] },
  { label: "Handovers", types: ["handover"] },
  { label: "Missed appointments", types: ["missed"] },
];

function TodoPage() {
  const { tasks, patients, completeTask } = useRelay();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(0);
  const counts = tileCounts(tasks);
  const types = FILTERS[filter]?.types ?? null;
  const open = tasks.filter((t) => !t.done && (!types || types.includes(t.type))).sort((a, b) => a.dueIn - b.dueIn);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle sub="One patient, one problem, one action. Most overdue first.">To do</PageTitle>
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[["Overdue", counts.overdue, "border-destructive"], ["Due today", counts.dueToday, "border-warning"], ["Done today", counts.doneToday, "border-success"]].map(([l, n, b]) => (
          <div key={l as string} className={cn("rounded-lg border-l-8 bg-card p-5", b as string)}>
            <div className="text-muted-foreground font-bold">{l}</div>
            <div className="text-5xl font-bold" data-testid={`tile-${l}`}>{n}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button key={f.label} onClick={() => setFilter(i)} aria-pressed={filter === i}
            className={cn("rounded-full border-2 border-primary px-4 py-1.5 font-bold", filter === i ? "bg-primary text-primary-foreground" : "bg-card text-primary")}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {open.length === 0 && <div className="rounded-lg bg-card p-8 text-center text-muted-foreground">Nothing here. Well done.</div>}
        {open.map((t) => {
          const p = patients.find((x) => x.id === t.patientId)!;
          const m = META[t.type];
          const due = t.dueIn < 0 ? `Overdue by ${-t.dueIn} day${t.dueIn === -1 ? "" : "s"}` : t.dueIn === 0 ? "Due today" : `Due in ${t.dueIn} days`;
          const act = () => {
            if (t.type === "longWait" || t.type === "returned") navigate({ to: "/find/$patientId", params: { patientId: p.id } });
            else { completeTask(t.id); toast.success(t.type === "handover" ? `Chased receiver for ${p.name}` : `Rebooking requested for ${p.name}`); }
          };
          return (
            <article key={t.id} className="flex items-center gap-6 rounded-lg border bg-card p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn("rounded px-2 py-0.5 text-sm font-bold",
                    t.dueIn < 0 ? "bg-danger-soft text-destructive" : t.dueIn === 0 ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground")}>{due}</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{m.title}</span>
                </div>
                <h2 className="mt-1 text-xl font-bold">{p.name}, {p.age} <span className="font-normal text-muted-foreground">· NHS {p.nhs}</span></h2>
                <p className="mt-1">{t.detail}</p>
                {t.type === "handover" && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Owner: sender until accepted</p>}
              </div>
              <Button size="lg" onClick={act} className="shrink-0">{m.button}</Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
