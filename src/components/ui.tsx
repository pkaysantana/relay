"use client";
import { useId, useState } from "react";
import type { AttentionReason } from "@/core/selectors";
import type { TaskStatus, TransferStatus } from "@/core/types";

/** All demo times shown in UK time (GMT in November, so equal to UTC). */
export function fmt(iso?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** datetime-local <-> ISO, treating input as UTC (labelled in the UI). */
export const toInput = (iso?: string) => (iso ? iso.slice(0, 16) : "");
export const fromInput = (v: string) => (v ? `${v}:00.000Z` : "");

export function hoursBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 3_600_000);
}

const TASK_TONE: Record<TaskStatus, string> = {
  draft: "bg-slate-100 text-slate-800 border-slate-300",
  requested: "bg-sky-50 text-sky-900 border-sky-300",
  received: "bg-sky-50 text-sky-900 border-sky-300",
  accepted: "bg-indigo-50 text-indigo-900 border-indigo-300",
  "in-progress": "bg-indigo-50 text-indigo-900 border-indigo-300",
  "on-hold": "bg-amber-50 text-amber-900 border-amber-400",
  completed: "bg-green-50 text-green-900 border-green-400",
  rejected: "bg-red-50 text-red-900 border-red-400",
  failed: "bg-red-50 text-red-900 border-red-400",
  cancelled: "bg-slate-100 text-slate-600 border-slate-300",
};

const ICON: Partial<Record<TaskStatus, string>> = {
  completed: "✓",
  rejected: "✕",
  failed: "✕",
  "on-hold": "‖",
};

export function TaskStatusBadge({ status, label }: { status: TaskStatus; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${TASK_TONE[status]}`}>
      {ICON[status] && <span aria-hidden>{ICON[status]}</span>}
      {label}
      <span className="sr-only"> (FHIR status {status})</span>
    </span>
  );
}

const TRANSFER_TONE: Record<TransferStatus, string> = {
  draft: "bg-slate-100 text-slate-800 border-slate-300",
  "info-confirmed": "bg-slate-100 text-slate-800 border-slate-300",
  "handover-ready": "bg-slate-100 text-slate-800 border-slate-300",
  sent: "bg-sky-50 text-sky-900 border-sky-300",
  received: "bg-sky-50 text-sky-900 border-sky-300",
  "clarification-requested": "bg-amber-50 text-amber-900 border-amber-400",
  accepted: "bg-green-50 text-green-900 border-green-400",
  rejected: "bg-red-50 text-red-900 border-red-400",
};

export function TransferStatusBadge({ status, label }: { status: TransferStatus; label: string }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${TRANSFER_TONE[status]}`}>
      {label}
    </span>
  );
}

const ATTENTION_TEXT: Record<AttentionReason, string> = {
  overdue: "⚠ Overdue",
  rejected: "✕ Rejected",
  failed: "✕ Failed",
  unassigned: "○ No named owner",
  blocked: "‖ Blocked",
};

export function AttentionBadges({ reasons }: { reasons: AttentionReason[] }) {
  if (!reasons.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {reasons.map((r) => (
        <span
          key={r}
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
            r === "unassigned" ? "bg-slate-200 text-slate-900" : "bg-red-700 text-white"
          }`}
        >
          {ATTENTION_TEXT[r]}
        </span>
      ))}
    </span>
  );
}

export function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {error}
    </div>
  );
}

/** A button that expands into a one-field form (reason, note, question...). */
export function TextAction({
  label,
  fieldLabel,
  submitLabel,
  variant = "secondary",
  onSubmit,
}: {
  label: string;
  fieldLabel: string;
  submitLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  onSubmit: (text: string) => boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button className={`btn-${variant}`} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  return (
    <form
      className="w-full rounded border border-slate-200 bg-slate-50 p-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit(text)) {
          setOpen(false);
          setText("");
        }
      }}
    >
      <label htmlFor={id} className="label">
        {fieldLabel}
      </label>
      <textarea id={id} className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className={`btn-${variant}`}>
          {submitLabel ?? label}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
