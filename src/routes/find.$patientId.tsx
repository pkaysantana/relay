import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/relay/bits";
import { rankProviders } from "@/lib/relay/logic";
import { providers } from "@/lib/relay/seed";
import { pname, useRelay } from "@/lib/relay/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/find/$patientId")({
  head: () => ({
    meta: [
      { title: "Find a provider – Relay" },
      { name: "description", content: "Ranked, suitable cataract providers for a long-waiting patient." },
      { property: "og:title", content: "Find a provider – Relay" },
      { property: "og:description", content: "Suitable providers first, then soonest surgery, then nearest." },
    ],
  }),
  component: FindProvider,
});

function FindProvider() {
  const { patientId } = Route.useParams();
  const { patients } = useRelay();
  const [sort, setSort] = useState<"soonest" | "nearest">("soonest");
  const p = patients.find((x) => x.id === patientId);
  if (!p) return <p>Patient not found.</p>;
  const ranked = rankProviders(p, providers, sort);
  const open = p.checklist.filter((c) => c.status !== "Complete").length;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/" className="font-bold text-primary underline">← Back to To do</Link>
      <section className="mt-4 rounded-lg border-l-8 border-primary bg-card p-6">
        <h1 className="text-3xl font-bold">{p.name}, {p.age}</h1>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
          {[["NHS number", p.nhs], ["Postcode", p.postcode], ["Eye", p.eye], ["Weeks waited", `${p.weeksWaited} weeks`], ["Current provider", pname(p.providerId)]].map(([k, v]) => (
            <div key={k}><div className="text-sm text-muted-foreground">{k}</div><div className="font-bold">{v}</div></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{p.flags.map((f) => <Chip key={f}>{f}</Chip>)}</div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="font-bold">Why this order: suitable providers first, then soonest surgery, then nearest.</p>
        <div className="flex rounded-md border border-input bg-card p-1">
          {(["soonest", "nearest"] as const).map((s) => (
            <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}
              className={cn("rounded px-4 py-1.5 font-bold capitalize", sort === s ? "bg-primary text-primary-foreground" : "text-primary")}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {ranked.map(({ provider: pr, suitable, reason, weeksSaved }, i) => (
          <article key={pr.id} className={cn("grid grid-cols-[1fr_auto_auto] items-center gap-6 rounded-lg border bg-card p-5", !suitable && "opacity-60 bg-muted")}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {suitable && <span className="text-lg font-bold text-primary">#{i + 1}</span>}
                <h2 className="text-xl font-bold">{pr.name}</h2>
                <Chip tone="info">{pr.type}</Chip>
              </div>
              <p className="mt-1 text-muted-foreground">{pr.miles} miles away · Post-op check: {pr.postOp}</p>
              <p className={cn("mt-1 font-bold", suitable ? "text-success" : "text-destructive")}>
                {suitable ? "✓ Suitable: takes complex cases, transport available" : `✕ ${reason}`}
              </p>
              {suitable && <p className="mt-1 text-sm">{open} checklist item{open === 1 ? "" : "s"} still needed before they can accept</p>}
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{pr.weeks}<span className="text-lg font-normal"> wks</span></div>
              <div className="text-sm text-muted-foreground">to surgery</div>
              {suitable && weeksSaved > 0 && <div className="mt-1 font-bold text-success">{weeksSaved} weeks sooner</div>}
            </div>
            {suitable ? (
              <Button size="lg" asChild><Link to="/transfer/$patientId/$providerId" params={{ patientId: p.id, providerId: pr.id }}>Transfer here</Link></Button>
            ) : <Button size="lg" disabled>Transfer here</Button>}
          </article>
        ))}
      </div>
    </div>
  );
}
