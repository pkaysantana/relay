"use client";
/**
 * Patient view. Layout ported from Keshav's Lovable prototype (components/relay/PatientView.tsx).
 * Reads the same canonical state as every other screen. Entirely fictional: no real booking,
 * transport, phone lines or response-time promises, and no NHS integration.
 */
import { useState } from "react";
import { patient } from "@/core/selectors";
import { PATIENT_STEPS, patientJourney } from "@/relay/view";
import { useDemoState } from "@/state/store";

export default function PatientPage() {
  const state = useDemoState();
  const [choice, setChoice] = useState("");
  // Default to the most recently created handover (the live demo patient once captured).
  const transfer = state.transfers.find((t) => t.id === choice) ?? state.transfers.at(-1);
  if (!transfer) return <p>No handovers in this demonstration.</p>;
  const p = patient(state, transfer.patientId);
  const j = patientJourney(state, transfer);

  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-lg bg-card p-4">
      <h2 className="mb-2 text-lg font-bold text-primary">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="flex flex-wrap items-center gap-3 font-bold">
        Synthetic patient
        <select className="input w-auto font-normal" value={transfer.id} onChange={(e) => setChoice(e.target.value)}>
          {state.transfers.map((t) => (
            <option key={t.id} value={t.id}>
              {patient(state, t.patientId)?.displayName} ({t.id})
            </option>
          ))}
        </select>
      </label>
      <div className="w-full max-w-[380px] rounded-[2.5rem] border-8 border-foreground bg-background p-4 shadow-xl">
        <div className="mb-1 text-center text-sm text-muted-foreground">Hello {p?.displayName}</div>
        <div className="mb-3 text-center text-xs font-bold text-warning-foreground">
          Fictional demonstration — not a real NHS service
        </div>
        <div className="flex flex-col gap-3">
          <Block title="Where am I?">
            <ol className="flex flex-col gap-2">
              {PATIENT_STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`flex items-center gap-3 ${i === j.step ? "font-bold" : i < j.step ? "" : "text-muted-foreground"}`}
                  aria-current={i === j.step ? "step" : undefined}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                      i < j.step
                        ? "border-primary bg-primary text-primary-foreground"
                        : i === j.step
                          ? "border-primary text-primary"
                          : "border-border"
                    }`}
                  >
                    {i < j.step ? "✓" : i + 1}
                  </span>
                  <span>
                    {s}
                    {i === j.step && " — you are here"}
                  </span>
                </li>
              ))}
            </ol>
            {j.returned && <p className="mt-2 font-bold text-destructive">The receiving provider did not accept this handover.</p>}
          </Block>
          <Block title="Who is looking after me?">
            <p>{j.lookingAfter}</p>
          </Block>
          <Block title="What happens next?">
            <p>{j.next}</p>
          </Block>
          <Block title="Who to contact">
            <p>In a real service this would show your care team&apos;s contact details. None are shown in this synthetic demonstration.</p>
          </Block>
        </div>
      </div>
    </div>
  );
}
