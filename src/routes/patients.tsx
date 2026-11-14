import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { JourneyBar, PageTitle, STEPS, StatusBadge } from "@/components/relay/bits";
import { pname, useRelay } from "@/lib/relay/store";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients – Relay" },
      { name: "description", content: "All synthetic cataract patients, their provider, step and owner." },
      { property: "og:title", content: "Patients – Relay" },
      { property: "og:description", content: "Search patients and open their care passport." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { patients, tasks } = useRelay();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = patients.filter((p) => `${p.name} ${p.nhs} ${p.nhs.replace(/ /g, "")}`.toLowerCase().includes(q.toLowerCase()));
  const sel = patients.find((p) => p.id === open);
  const statusOf = (id: string) => {
    const t = tasks.find((x) => x.patientId === id && !x.done);
    return t ? ({ longWait: "Long wait", handover: "Awaiting acceptance", missed: "Missed appointment", returned: "Returned" })[t.type] : "On track";
  };
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle>Patients</PageTitle>
      <Input placeholder="Search by name or NHS number" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md bg-card" />
      <div className="overflow-hidden rounded-lg bg-card">
        <table className="w-full text-left">
          <thead className="bg-muted text-sm"><tr>{["Name", "NHS number", "Age", "Current provider", "Step", "Owner", "Weeks waited", "Status"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer border-t hover:bg-accent">
                <td className="px-4 py-3 font-bold text-primary">{p.name}</td><td className="px-4 py-3">{p.nhs}</td><td className="px-4 py-3">{p.age}</td>
                <td className="px-4 py-3">{pname(p.providerId)}</td><td className="px-4 py-3">{STEPS[p.step]}</td><td className="px-4 py-3">{p.owner}</td>
                <td className="px-4 py-3">{p.weeksWaited}</td><td className="px-4 py-3">{statusOf(p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-[520px] overflow-y-auto sm:max-w-[520px]">
          {sel && (
            <>
              <SheetHeader><SheetTitle className="text-2xl">Passport: {sel.name}</SheetTitle></SheetHeader>
              <div className="flex flex-col gap-6 px-4 pb-8">
                <JourneyBar step={sel.step} />
                <div>
                  <h3 className="mb-2 font-bold">Checklist</h3>
                  {sel.checklist.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-2 border-b py-2">
                      <div><div className="text-sm text-muted-foreground">{c.label}</div><div>{c.value}</div></div><StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 font-bold">Owner timeline</h3>
                  <ol className="border-l-4 border-primary pl-4">
                    {sel.events.map((e, i) => (
                      <li key={i} className="mb-3"><div className="text-sm text-muted-foreground">{e.day} · {e.owner}</div><div>{e.text}</div></li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
