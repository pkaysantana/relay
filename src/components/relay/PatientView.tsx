import { HERO_ID } from "@/lib/relay/seed";
import { pname, useRelay } from "@/lib/relay/store";
import { STEPS } from "./bits";
import { cn } from "@/lib/utils";

export function PatientView() {
  const { patients, handovers } = useRelay();
  const p = patients.find((x) => x.id === HERO_ID)!;
  const h = [...handovers].reverse().find((x) => x.patientId === HERO_ID);
  const owner = h?.status === "Sent" ? `Your current team at ${pname(p.providerId)} until ${pname(h.providerId)} accepts you` : p.owner;
  const next =
    h?.status === "Sent" ? `We have asked ${pname(h.providerId)} to do your operation sooner. They will reply within 2 working days.`
    : h?.status === "Accepted" ? `${pname(h.providerId)} will call you to book a pre-op check. Transport will be arranged.`
    : "You are on the waiting list. We are looking for a hospital that can see you sooner.";
  const call = h?.status === "Accepted" ? `${pname(h.providerId)} bookings: 0161 000 0002` : "Northfield Royal Eye Unit: 0161 000 0001";
  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-lg bg-card p-4"><h2 className="mb-2 text-lg font-bold text-primary">{title}</h2>{children}</section>
  );
  return (
    <div className="flex justify-center">
      <div className="w-[380px] rounded-[2.5rem] border-8 border-foreground bg-background p-4 shadow-xl">
        <div className="mb-3 text-center text-sm text-muted-foreground">Hello {p.name.split(" ")[0]}</div>
        <div className="flex flex-col gap-3">
          <Block title="Where am I?">
            <ol className="flex flex-col gap-2">
              {STEPS.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-3", i === p.step ? "font-bold" : i < p.step ? "" : "text-muted-foreground")}>
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm",
                    i < p.step ? "border-primary bg-primary text-primary-foreground" : i === p.step ? "border-primary text-primary" : "border-border")}>
                    {i < p.step ? "✓" : i + 1}
                  </span>
                  {s}{i === p.step && " – you are here"}
                </li>
              ))}
            </ol>
          </Block>
          <Block title="Who is looking after me?"><p>{owner}</p></Block>
          <Block title="What happens next?"><p>{next}</p></Block>
          <Block title="Who to call"><p>{call}</p><p className="mt-1 text-sm text-muted-foreground">Urgent eye problem: call NHS 111</p></Block>
        </div>
      </div>
    </div>
  );
}
