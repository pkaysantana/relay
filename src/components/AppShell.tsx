"use client";
/**
 * App shell. Layout and visual language ported from Keshav's Lovable prototype
 * (components/relay/AppShell.tsx on keshav-branch): sidebar, "Viewing as" role switch and
 * prototype banner. Roles are routes here, and all state comes from the engine store.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SYSTEM_ACTOR } from "@/core/engine";
import { DEMO_SETS, type DemoSetId } from "@/scenarios";
import { resetDemo, useCommand, useDemoSet, useDemoState } from "@/state/store";
import { ErrorAlert, fmt } from "./ui";

const NAV = [
  { href: "/", label: "To do" },
  { href: "/hub", label: "Handovers" },
  { href: "/dashboard", label: "Reports" },
];
const ROLES = [
  { href: "/", label: "Coordinator" },
  { href: "/receive", label: "Receiving provider" },
  { href: "/patient", label: "Patient" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const state = useDemoState();
  const { run, error } = useCommand();
  const [confirmReset, setConfirmReset] = useState(false);
  const demoSet = useDemoSet();
  const role = path.startsWith("/receive") ? "/receive" : path.startsWith("/patient") ? "/patient" : "/";
  const navActive = (href: string) => role === "/" && (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-card focus:p-2">
        Skip to content
      </a>
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-60">
        <div className="px-6 py-4 text-3xl font-bold tracking-tight md:py-6">Relay</div>
        <nav aria-label="Coordinator views" className="flex gap-1 px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={navActive(n.href) ? "page" : undefined}
              className={`rounded-md px-3 py-3 text-lg font-bold transition-colors ${
                navActive(n.href) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden p-6 text-sm opacity-90 md:block">
          Hackathon prototype. Relay is an illustrative handover-readiness and accountability layer intended to complement existing
          referral and elective-care systems (e.g. NHS e-RS, Shared PTL, mutual-aid workflows), not replace them.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-card">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-muted-foreground">Viewing as</span>
              <nav aria-label="Role" className="flex rounded-md border border-input p-1">
                {ROLES.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    aria-current={role === r.href ? "true" : undefined}
                    className={`rounded px-4 py-2 font-bold ${
                      role === r.href ? "bg-primary text-primary-foreground" : "text-primary hover:bg-accent"
                    }`}
                  >
                    {r.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                <span className="text-muted-foreground">Demo:</span>
                <select
                  className="input w-auto"
                  value={demoSet}
                  onChange={(e) => {
                    resetDemo(e.target.value as DemoSetId);
                    setConfirmReset(false);
                  }}
                >
                  {(Object.keys(DEMO_SETS) as DemoSetId[]).map((k) => (
                    <option key={k} value={k}>
                      {DEMO_SETS[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                Demo clock: <time className="font-mono font-medium">{fmt(state.now)}</time>
              </span>
              {[6, 24].map((h) => (
                <button key={h} className="btn-secondary" onClick={() => run({ type: "advanceClock", actorId: SYSTEM_ACTOR, hours: h })}>
                  +{h}h
                </button>
              ))}
              {confirmReset ? (
                <>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      resetDemo();
                      setConfirmReset(false);
                    }}
                  >
                    Confirm reset
                  </button>
                  <button className="btn-secondary" onClick={() => setConfirmReset(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <button className="btn-secondary" onClick={() => setConfirmReset(true)}>
                  Reset demo
                </button>
              )}
            </div>
          </div>
          <div role="note" className="border-t border-warning bg-warning px-4 py-2 font-bold text-warning-foreground md:px-8">
            ⚠ Prototype – synthetic data only, not for clinical use. Relay checks information and records decisions; clinicians and
            patients decide.
          </div>
          {error && (
            <div className="px-4 py-2 md:px-8">
              <ErrorAlert error={error} />
            </div>
          )}
        </header>
        <main id="main" className="flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
