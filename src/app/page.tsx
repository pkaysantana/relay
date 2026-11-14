"use client";
/**
 * Coordinator To-do. Layout and visual language ported from Keshav's Lovable prototype
 * (src/routes/index.tsx on keshav-branch). Every card and count is derived from the canonical
 * engine state via src/relay/view.ts — there is no separate task store.
 */
import Link from "next/link";
import { todoItems, todoTiles } from "@/relay/view";
import { useDemoState } from "@/state/store";

export default function TodoPage() {
  const state = useDemoState();
  const items = todoItems(state);
  const tiles = todoTiles(state);
  const tileList: [string, number, string][] = [
    ["Overdue", tiles.overdue, "border-destructive"],
    ["Needs action", tiles.needsAction, "border-warning"],
    ["Completed with evidence", tiles.completedWithEvidence, "border-success"],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">To do</h1>
        <p className="mt-1 text-muted-foreground">
          One patient, one problem, one action. Overdue first. Simulated from the synthetic event history.
        </p>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tileList.map(([label, n, border]) => (
          <div key={label} className={`rounded-lg border-l-8 bg-card p-5 ${border}`}>
            <div className="font-bold text-muted-foreground">{label}</div>
            <div className="text-5xl font-bold tabular-nums">{n}</div>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-4">
        {items.length === 0 && <li className="rounded-lg bg-card p-8 text-center text-muted-foreground">Nothing needs action.</li>}
        {items.map((t) => (
          <li key={t.id}>
            <article className="flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-sm font-bold ${
                      t.overdue ? "bg-danger-soft text-destructive" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.overdue ? "⚠ " : ""}
                    {t.dueLabel}
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.title}</span>
                </div>
                <h2 className="mt-1 text-xl font-bold">
                  {t.patientName} <span className="font-normal text-muted-foreground">· NHS {t.nhsNumber} (synthetic)</span>
                </h2>
                <p className="mt-1">{t.detail}</p>
                <p className="mt-1 text-sm text-muted-foreground">Owner: {t.owner}</p>
              </div>
              <Link href={t.href} className="btn-primary shrink-0 justify-center px-5 py-3 text-base">
                {t.button}
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
