import { createContext, useContext, useState, type ReactNode } from "react";
import { providers, seedHandovers, seedPatients, seedTasks } from "./seed";
import type { ChecklistItem, Handover, Patient, Role, Task } from "./types";

interface Store {
  role: Role;
  setRole: (r: Role) => void;
  patients: Patient[];
  tasks: Task[];
  handovers: Handover[];
  lastProviderId: string;
  completeTask: (id: string) => void;
  sendHandover: (patientId: string, providerId: string, checklist: ChecklistItem[], signedBy: string) => void;
  acceptHandover: (id: string) => void;
  returnHandover: (id: string, reason: string) => void;
}

const Ctx = createContext<Store | null>(null);
const pname = (id: string) => providers.find((p) => p.id === id)?.name ?? id;

export function RelayProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Coordinator");
  const [patients, setPatients] = useState(seedPatients);
  const [tasks, setTasks] = useState(seedTasks);
  const [handovers, setHandovers] = useState(seedHandovers);
  const [lastProviderId, setLast] = useState("riverside");

  const patchPatient = (id: string, f: (p: Patient) => Patient) => setPatients((ps) => ps.map((p) => (p.id === id ? f(p) : p)));

  const store: Store = {
    role, setRole, patients, tasks, handovers, lastProviderId,
    completeTask: (id) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: true, doneToday: true } : t))),
    sendHandover: (patientId, providerId, checklist, signedBy) => {
      const id = `h${Date.now()}`;
      setHandovers((hs) => [...hs, { id, patientId, providerId, status: "Sent", sentDaysAgo: 0, owner: "Sender until accepted", signedBy }]);
      setTasks((ts) => [
        ...ts.filter((t) => !(t.patientId === patientId && !t.done && (t.type === "longWait" || t.type === "returned"))),
        { id: `t${Date.now()}`, type: "handover", patientId, dueIn: 2, done: false, doneToday: false, handoverId: id,
          detail: `Sent 0 days ago to ${pname(providerId)}, accept within 2 working days.` },
      ]);
      patchPatient(patientId, (p) => ({
        ...p, checklist, owner: "Sender until accepted",
        events: [...p.events, { day: "Today", text: `Handover sent to ${pname(providerId)} (signed: ${signedBy})`, owner: "Sender until accepted" }],
      }));
      setLast(providerId);
    },
    acceptHandover: (id) => {
      const h = handovers.find((x) => x.id === id)!;
      setHandovers((hs) => hs.map((x) => (x.id === id ? { ...x, status: "Accepted", owner: pname(x.providerId) } : x)));
      setTasks((ts) => ts.map((t) => (t.handoverId === id ? { ...t, done: true, doneToday: true } : t)));
      patchPatient(h.patientId, (p) => ({
        ...p, providerId: h.providerId, owner: pname(h.providerId), step: Math.max(p.step, 2),
        events: [...p.events, { day: "Today", text: `Handover accepted by ${pname(h.providerId)}`, owner: pname(h.providerId) }],
      }));
    },
    returnHandover: (id, reason) => {
      const h = handovers.find((x) => x.id === id)!;
      setHandovers((hs) => hs.map((x) => (x.id === id ? { ...x, status: "Returned", reason, owner: "Coordinator" } : x)));
      setTasks((ts) => [
        ...ts.filter((t) => t.handoverId !== id),
        { id: `t${Date.now()}`, type: "returned", patientId: h.patientId, dueIn: 0, done: false, doneToday: false,
          detail: `Returned by ${pname(h.providerId)}. Reason: ${reason}.` },
      ]);
      patchPatient(h.patientId, (p) => ({
        ...p, owner: pname(p.providerId),
        events: [...p.events, { day: "Today", text: `Returned by ${pname(h.providerId)}: ${reason}`, owner: "Coordinator" }],
      }));
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useRelay() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useRelay outside RelayProvider");
  return s;
}
export { pname };
