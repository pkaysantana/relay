import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { providers } from "@/lib/relay/seed";
import { useRelay } from "@/lib/relay/store";
import { Chip, PageTitle, StatusBadge } from "./bits";

const REASONS = ["Information missing", "Not suitable", "No capacity"];

export function ReceiverInbox() {
  const { handovers, patients, lastProviderId, acceptHandover, returnHandover } = useRelay();
  const [providerId, setProviderId] = useState(lastProviderId);
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("Information missing");
  const waiting = handovers.filter((h) => h.providerId === providerId && h.status === "Sent");

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle sub="Handovers sent to you that are waiting for a decision.">Receiver inbox</PageTitle>
      <label className="mb-6 flex items-center gap-3 font-bold">
        Provider
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2 font-normal">
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {waiting.length === 0 && <div className="rounded-lg bg-card p-8 text-center text-muted-foreground">No handovers waiting for this provider.</div>}
      <div className="flex flex-col gap-6">
        {waiting.map((h) => {
          const p = patients.find((x) => x.id === h.patientId)!;
          return (
            <article key={h.id} className="rounded-lg border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl font-bold">{p.name}, {p.age}</h2>
                <span className="text-muted-foreground">Sent {h.sentDaysAgo} days ago · signed by {h.signedBy}</span>
              </div>
              <p className="mt-1">NHS {p.nhs} · {p.postcode} · {p.eye} eye cataract · waited {p.weeksWaited} weeks</p>
              <div className="mt-3 flex flex-wrap gap-2">{p.flags.map((f) => <Chip key={f}>{f}</Chip>)}</div>
              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                {p.checklist.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 border-b pb-2">
                    <div><dt className="text-sm text-muted-foreground">{c.label}</dt><dd className="font-bold">{c.value}</dd></div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </dl>
              {returning === h.id ? (
                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md bg-muted p-4">
                  <label className="font-bold">Reason
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className="ml-2 rounded-md border border-input bg-card px-3 py-2 font-normal">
                      {REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <Button variant="destructive" size="lg" onClick={() => { returnHandover(h.id, reason); setReturning(null); toast("Handover returned to coordinator"); }}>Confirm return</Button>
                  <Button variant="ghost" size="lg" onClick={() => setReturning(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="mt-6 flex gap-3">
                  <Button size="lg" onClick={() => { acceptHandover(h.id); toast.success(`Accepted. ${p.name} is now your patient.`); }}>Accept</Button>
                  <Button size="lg" variant="outline" onClick={() => setReturning(h.id)}>Return</Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
