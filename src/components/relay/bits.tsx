import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Status } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

export const STEPS = ["Referred", "On list", "Pre-op", "Surgery", "Post-op check"];

export function StatusBadge({ status }: { status: Status }) {
  const map = {
    Complete: ["bg-success-soft text-success border-success", CheckCircle2],
    Unclear: ["bg-warning-soft text-warning-foreground border-warning", AlertTriangle],
    Missing: ["bg-danger-soft text-destructive border-destructive", XCircle],
  } as const;
  const [cls, Icon] = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-bold", cls)}>
      <Icon className="h-4 w-4" aria-hidden /> {status}
    </span>
  );
}

export function Chip({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "info" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-bold",
      tone === "warn" ? "border-warning bg-warning-soft text-warning-foreground" : "border-primary bg-secondary text-secondary-foreground")}>
      {children}
    </span>
  );
}

export function JourneyBar({ step }: { step: number }) {
  return (
    <ol className="flex w-full gap-1">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={cn("h-2 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
          <div className={cn("mt-1 text-xs", i === step ? "font-bold text-primary" : "text-muted-foreground")}>
            {i === step ? "● " : ""}{s}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold">{children}</h1>
      {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
    </div>
  );
}
