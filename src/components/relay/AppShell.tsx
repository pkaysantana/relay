import { Link, useRouterState } from "@tanstack/react-router";
import { ListTodo, Users, BarChart3, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useRelay } from "@/lib/relay/store";
import type { Role } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { ReceiverInbox } from "./ReceiverInbox";
import { PatientView } from "./PatientView";

const nav = [
  { to: "/", label: "To do", icon: ListTodo },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;
const roles: Role[] = ["Coordinator", "Receiving provider", "Patient"];

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole } = useRelay();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-6 text-3xl font-bold tracking-tight">Relay</div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" || path.startsWith("/find") || path.startsWith("/transfer") : path.startsWith(to);
            return (
              <Link key={to} to={to} onClick={() => setRole("Coordinator")}
                className={cn("flex items-center gap-3 rounded-md px-3 py-3 text-lg font-bold transition-colors",
                  active && role === "Coordinator" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent")}>
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-6 text-sm opacity-80">NHS hackathon prototype</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-card">
          <div className="flex items-center justify-between gap-4 px-8 py-3">
            <span className="font-bold text-muted-foreground">Viewing as</span>
            <div role="radiogroup" aria-label="Role" className="flex rounded-md border border-input p-1">
              {roles.map((r) => (
                <button key={r} role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                  className={cn("rounded px-4 py-2 font-bold", role === r ? "bg-primary text-primary-foreground" : "text-primary hover:bg-accent")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-warning bg-warning px-8 py-2 font-bold text-warning-foreground">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Prototype – synthetic data only. Suggestions are decision support; a clinician decides.
          </div>
        </header>
        <main className="flex-1 px-8 py-8">
          {role === "Coordinator" ? children : role === "Receiving provider" ? <ReceiverInbox /> : <PatientView />}
        </main>
      </div>
    </div>
  );
}
