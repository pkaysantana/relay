import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/relay/bits";
import { pname, useRelay } from "@/lib/relay/store";
import type { ChecklistItem } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transfer/$patientId/$providerId")({
  head: () => ({
    meta: [
      { title: "Transfer check – Relay" },
      { name: "description", content: "Complete and sign the handover checklist before sending to the receiving provider." },
      { property: "og:title", content: "Transfer check – Relay" },
      { property: "og:description", content: "Every item checked against the referral letter before handover." },
    ],
  }),
  component: TransferCheck,
});

function TransferCheck() {
  const { patientId, providerId } = Route.useParams();
  const { patients, sendHandover } = useRelay();
  const navigate = useNavigate();
  const p = patients.find((x) => x.id === patientId)!;
  const [items, setItems] = useState<ChecklistItem[]>(() => p.checklist.map((c) => ({ ...c })));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const done = items.filter((i) => i.status === "Complete").length;
  const canSend = done === items.length && name.trim() && role.trim();
  const quote = items.find((i) => i.key === selected)?.quote;

  const save = (key: string) => {
    const v = drafts[key]?.trim();
    if (!v) return;
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, value: v, status: "Complete", note: "Added by sender" } : x)));
  };
  const letterParts = quote && p.letter.includes(quote) ? p.letter.split(quote) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/find/$patientId" params={{ patientId }} className="font-bold text-primary underline">← Back to providers</Link>
      <h1 className="mt-3 text-3xl font-bold">Transfer check: {p.name} → {pname(providerId)}</h1>
      <p className="mt-1 text-lg font-bold" aria-live="polite">{done} of {items.length} complete</p>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-border"><div className="h-full bg-success transition-all" style={{ width: `${(done / items.length) * 100}%` }} /></div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Handover checklist</h2>
          {items.map((i) => (
            <div key={i.key} className={cn("rounded-lg border-2 bg-card p-4", selected === i.key ? "border-primary" : "border-transparent")}>
              <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setSelected(i.key)}>
                <div>
                  <div className="text-sm text-muted-foreground">{i.label}</div>
                  <div className="font-bold">{i.value}</div>
                  {i.note && <div className="text-sm text-muted-foreground">{i.note}</div>}
                </div>
                <StatusBadge status={i.status} />
              </button>
              {i.status !== "Complete" && (
                <form className="mt-3 flex flex-col gap-2 rounded-md bg-muted p-3" onSubmit={(e) => { e.preventDefault(); save(i.key); }}>
                  <label htmlFor={`q-${i.key}`} className="font-bold">{i.question}</label>
                  <div className="flex gap-2">
                    <Input id={`q-${i.key}`} value={drafts[i.key] ?? ""} onChange={(e) => setDrafts({ ...drafts, [i.key]: e.target.value })} className="bg-card" />
                    <Button type="submit">Save</Button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </section>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-xl font-bold">Referral letter (source)</h2>
          <div className="mt-3 rounded-lg bg-card p-5 text-lg leading-relaxed">
            {letterParts ? <>{letterParts[0]}<mark className="rounded bg-highlight px-0.5 text-foreground">{quote}</mark>{letterParts.slice(1).join(quote)}</> : p.letter}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Click a checklist item to see where it came from.</p>
          <div className="mt-6 rounded-lg border bg-card p-5">
            <h2 className="text-xl font-bold">Sign-off</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="font-bold">Your name<Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></label>
              <label className="font-bold">Your role<Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" /></label>
            </div>
            <Button size="lg" className="mt-4 w-full" disabled={!canSend}
              onClick={() => { sendHandover(p.id, providerId, items, `${name}, ${role}`); toast.success(`Handover sent to ${pname(providerId)}`); navigate({ to: "/" }); }}>
              Send handover
            </Button>
            {!canSend && <p className="mt-2 text-sm text-muted-foreground">Complete every item and sign off to send.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
