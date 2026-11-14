import type { Patient, Provider, Task } from "./types";

export function unsuitableReason(pt: Pick<Patient, "onlyOneGoodEye" | "needsTransport" | "needsGeneralAnaesthetic">, pr: Provider): string | null {
  const r: string[] = [];
  if (pt.onlyOneGoodEye && !pr.acceptsComplex) r.push("does not take patients with only one good eye");
  if (pt.needsTransport && !pr.transport) r.push("does not provide transport");
  if (pt.needsGeneralAnaesthetic && !pr.generalAnaesthetic) r.push("cannot offer general anaesthetic");
  return r.length ? `Not suitable: ${r.join("; ")}` : null;
}

export interface Ranked { provider: Provider; reason: string | null; suitable: boolean; weeksSaved: number }

export function rankProviders(pt: Patient, list: Provider[], sort: "soonest" | "nearest" = "soonest"): Ranked[] {
  const current = list.find((x) => x.id === pt.providerId);
  const rows = list
    .filter((x) => x.id !== pt.providerId)
    .map((provider) => {
      const reason = unsuitableReason(pt, provider);
      return { provider, reason, suitable: !reason, weeksSaved: (current?.weeks ?? pt.weeksWaited) - provider.weeks };
    });
  const cmp = (a: Ranked, b: Ranked) =>
    sort === "soonest"
      ? a.provider.weeks - b.provider.weeks || a.provider.miles - b.provider.miles
      : a.provider.miles - b.provider.miles || a.provider.weeks - b.provider.weeks;
  return [...rows.filter((r) => r.suitable).sort(cmp), ...rows.filter((r) => !r.suitable).sort(cmp)];
}

export function tileCounts(tasks: Task[]) {
  const open = tasks.filter((t) => !t.done);
  return {
    overdue: open.filter((t) => t.dueIn < 0).length,
    dueToday: open.filter((t) => t.dueIn === 0).length,
    doneToday: tasks.filter((t) => t.doneToday).length,
  };
}
