"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SYSTEM_ACTOR } from "@/core/engine";
import { resetDemo, useCommand, useDemoState } from "@/state/store";
import { ErrorAlert, fmt } from "./ui";

const NAV = [
  { href: "/hub", label: "Sending team" },
  { href: "/receive", label: "Receiving team" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const state = useDemoState();
  const { run, error } = useCommand();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white">
        Skip to content
      </a>
      <div role="note" className="bg-amber-100 text-amber-950 text-sm px-4 py-1 text-center">
        Prototype · synthetic data only · not for clinical use
      </div>
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-semibold text-lg">Doorstep</span>
          <nav aria-label="Views" className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path === n.href ? "page" : undefined}
                className={`px-3 py-1.5 rounded text-sm ${
                  path === n.href ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <span>
              Demo clock: <time className="font-mono font-medium">{fmt(state.now)}</time>
            </span>
            {[6, 24].map((h) => (
              <button
                key={h}
                className="btn-secondary"
                onClick={() => run({ type: "advanceClock", actorId: SYSTEM_ACTOR, hours: h })}
              >
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
        {error && (
          <div className="mx-auto max-w-7xl px-4 pb-2">
            <ErrorAlert error={error} />
          </div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </>
  );
}
