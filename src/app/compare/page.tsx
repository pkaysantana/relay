"use client";
/**
 * Compare providers — coordinator decision support on FICTIONAL data.
 * Reads the canonical demo state and the pure comparison in src/relay/shortlist.ts.
 * This screen changes nothing: proposing a destination only links into the existing handover
 * workflow, where patient agreement, clinical confirmation and sign-off are still required.
 */
import { useEffect, useState } from "react";
import { preparedDocument } from "@/data/documents";
import { PATIENT_PREFERENCES, PROVIDER_CATALOGUE, SIMULATED_NOTE, preferencesFor, requirementsFor } from "@/relay/providerCatalogue";
import { compareProviders, proposeDestination, type ShortlistEntry, type ShortlistGroup, type SortMode } from "@/relay/shortlist";
import { useDemoState } from "@/state/store";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "score", label: "Illustrative preference score" },
  { id: "soonest", label: "Soonest simulated wait" },
  { id: "nearest", label: "Shortest simulated distance" },
];
const GROUPS: { id: ShortlistGroup; title: string; help: string }[] = [
  { id: "compared", title: "Compared", help: "Positioned by the illustrative administrative comparison." },
  {
    id: "clinical-review",
    title: "Capability requires clinical review",
    help: "Not positioned and not excluded. A clinician must review the documented requirement against this provider.",
  },
  { id: "not-compared", title: "Not compared", help: "Information is missing or the provider is not currently available (simulated)." },
];
const PRIORITY_LABEL = { "shorter-wait": "Shorter wait matters more", closer: "Staying closer matters more", balanced: "Balanced" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function ComparePage() {
  const state = useDemoState();
  // Catalogue order, so Case 1 is the default.
  const candidates = PATIENT_PREFERENCES.flatMap((x) => state.patients.filter((p) => p.id === x.patientId));
  const [choice, setChoice] = useState("");
  const [sort, setSort] = useState<SortMode>("score");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    if (p) setChoice(p);
  }, []);

  const pt = candidates.find((p) => p.id === choice) ?? candidates[0];
  if (!pt)
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Compare providers</h1>
        <p className="mt-2 rounded-lg bg-card p-6">
          The fictional provider catalogue covers the cataract demonstration only. Switch <strong>Demo</strong> to “Cataract: NHS eye service → independent
          provider”.
        </p>
      </div>
    );

  const pref = preferencesFor(pt.id)!;
  const reqs = requirementsFor(pt.id);
  const list = compareProviders({ patientId: pt.id, preferences: pref, requirements: reqs, providers: PROVIDER_CATALOGUE, sort });
  const selectedKey = `${pt.id}:${selected}`;
  const chosen = list.entries.find((e) => `${pt.id}:${e.provider.id}` === selectedKey);
  const proposal = chosen ? proposeDestination(state, pt.id, chosen.provider) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Compare providers</h1>
        <p className="mt-1 text-muted-foreground">
          Illustrative administrative comparison. Relay does not choose a provider or assess clinical fitness for surgery — the patient and the clinical team
          decide.
        </p>
      </div>
      <p role="note" className="mb-6 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm font-bold">
        {SIMULATED_NOTE}
      </p>

      <label className="mb-6 flex flex-wrap items-center gap-3 font-bold">
        Synthetic patient
        <select
          className="input w-auto font-normal"
          value={pt.id}
          onChange={(e) => {
            setChoice(e.target.value);
            setSelected(null);
          }}
        >
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} · NHS {p.nhsNumber} — {preferencesFor(p.id)?.caseLabel}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Patient preferences</h2>
            <span
              className={`rounded-full border px-3 py-0.5 text-sm font-bold ${
                pref.confirmed ? "border-success bg-success-soft" : "border-warning bg-warning-soft"
              }`}
            >
              {pref.confirmed ? "✓ Confirmed with patient" : "! Not yet confirmed with patient"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Maximum travel</dt>
            <dd>{pref.maxTravelKm === null ? "Not recorded" : `${pref.maxTravelKm} km`}</dd>
            <dt className="text-muted-foreground">Wait versus distance</dt>
            <dd>{pref.priority === null ? "Not recorded" : PRIORITY_LABEL[pref.priority]}</dd>
            <dt className="text-muted-foreground">Needs transport</dt>
            <dd>{pref.needsTransport === "unknown" ? "Not recorded" : pref.needsTransport === "yes" ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Access needs</dt>
            <dd>{pref.accessNeeds.length ? pref.accessNeeds.map((a) => a.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ") : "None recorded"}</dd>
            <dt className="text-muted-foreground">Stated provider preference</dt>
            <dd>{pref.preferredProviderIds.length ? pref.preferredProviderIds.join(", ") : "None recorded"}</dd>
            <dt className="text-muted-foreground">Recorded by</dt>
            <dd>{pref.recordedBy}</dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="text-xl font-bold">Clinician-documented requirements</h2>
          {reqs.length === 0 ? (
            <p className="mt-3 text-sm">None documented in the synthetic record. Relay does not infer clinical needs from age, eyes, medicines or history.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {reqs.map((r) => (
                <li key={r.capability}>
                  <strong>{r.label}</strong>
                  <div>
                    <q className="rounded bg-highlight px-1">{r.quote}</q>
                  </div>
                  <div className="text-muted-foreground">Source: {preparedDocument(r.documentId).title}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {list.notes.length > 0 && (
        <ul role="status" className="mb-6 list-disc rounded-md border border-warning bg-warning-soft py-2 pl-8 pr-3 text-sm font-bold">
          {list.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold">Order by</span>
        {SORTS.map((o) => (
          <button
            key={o.id}
            onClick={() => setSort(o.id)}
            aria-pressed={sort === o.id}
            className={`min-h-10 rounded-full border-2 border-primary px-4 py-1.5 font-bold ${
              sort === o.id ? "bg-primary text-primary-foreground" : "bg-card text-primary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Score weights for “{PRIORITY_LABEL[list.priorityUsed]}”: wait {pct(list.weights.wait)} · distance {pct(list.weights.distance)} · stated non-clinical
        preferences {pct(list.weights.preferences)}. Demonstration assumptions, not validated NHS prioritisation weights. Clinical questions are never scored.
      </p>

      {proposal && chosen && (
        <section role="status" aria-live="polite" className="mb-6 rounded-lg border-2 border-primary bg-card p-5">
          <h2 className="text-xl font-bold">Proposed for discussion: {chosen.provider.name}</h2>
          <p className="mt-1 font-bold">This is a proposal for the patient and clinical team to discuss. It is not patient agreement and nothing has been sent.</p>
          <p className="mt-2 text-sm">{proposal.note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.href && (
              <a href={proposal.href} className="btn-primary">
                {proposal.label}
              </a>
            )}
            <button className="btn-secondary" onClick={() => setSelected(null)}>
              Clear proposal
            </button>
          </div>
        </section>
      )}

      {GROUPS.map((g) => {
        const rows = list.entries.filter((e) => e.group === g.id);
        if (!rows.length) return null;
        return (
          <section key={g.id} className="mb-8" aria-label={g.title}>
            <h2 className="text-xl font-bold">
              {g.title} ({rows.length})
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{g.help}</p>
            <ul className="flex flex-col gap-4">
              {rows.map((e) => (
                <ProviderCard key={e.provider.id} e={e} selected={selected === e.provider.id} onSelect={() => setSelected(e.provider.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ProviderCard({ e, selected, onSelect }: { e: ShortlistEntry; selected: boolean; onSelect: () => void }) {
  const availability =
    e.availability === "confirmed"
      ? "Capacity confirmed (simulated)"
      : e.availability === "unavailable"
        ? "✕ Not currently available (simulated)"
        : "? Capacity unconfirmed";
  return (
    <li>
      <article className={`rounded-lg border-2 bg-card p-5 ${selected ? "border-primary" : "border-transparent"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-xl font-bold">
            {e.position !== null && <span className="mr-2 text-primary">#{e.position}</span>}
            {e.provider.name}
          </h3>
          <span className="rounded-full border px-3 py-0.5 text-sm font-bold">{availability}</span>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
          <div>
            <dt className="text-sm text-muted-foreground">Simulated estimated wait</dt>
            <dd className="text-lg font-bold">{e.estimatedWaitWeeks === null ? "Not known" : `${e.estimatedWaitWeeks} weeks`}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Simulated travel distance</dt>
            <dd className="text-lg font-bold">{e.distanceKm === null ? "Not known" : `${e.distanceKm} km`}</dd>
          </div>
          {e.score !== null && e.components && (
            <div>
              <dt className="text-sm text-muted-foreground">Illustrative score</dt>
              <dd className="text-lg font-bold tabular-nums">
                {e.score.toFixed(3)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (wait {e.components.wait} · distance {e.components.distance} · preferences {e.components.preferences})
                </span>
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-3">{e.explanation}</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          {e.clinicalReview.length > 0 && (
            <ul className="rounded-md border border-destructive bg-danger-soft p-2 font-bold md:col-span-2">
              {e.clinicalReview.map((x) => (
                <li key={x}>⚠ {x}</li>
              ))}
            </ul>
          )}
          {e.satisfied.length > 0 && (
            <ul aria-label="Preferences met">
              {e.satisfied.map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
          )}
          {e.conflicts.length > 0 && (
            <ul aria-label="Conflicts with stated preferences" className="font-bold text-destructive">
              {e.conflicts.map((x) => (
                <li key={x}>✕ Conflict: {x}</li>
              ))}
            </ul>
          )}
          {e.missing.length > 0 && (
            <ul aria-label="Missing information">
              {e.missing.map((x) => (
                <li key={x}>? Missing: {x}</li>
              ))}
            </ul>
          )}
        </div>
        <button className={`mt-4 ${selected ? "btn-secondary" : "btn-primary"}`} onClick={onSelect} aria-pressed={selected}>
          {selected ? "Proposed for discussion" : "Propose for discussion"}
        </button>
      </article>
    </li>
  );
}
