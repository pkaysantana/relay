import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { PageTitle } from "@/components/relay/bits";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports – Relay" },
      { name: "description", content: "Handover acceptance times, return reasons and missing items caught." },
      { property: "og:title", content: "Reports – Relay" },
      { property: "og:description", content: "How well handovers are working." },
    ],
  }),
  component: Reports,
});

const returned = [{ reason: "Information missing", n: 7 }, { reason: "Not suitable", n: 3 }, { reason: "No capacity", n: 5 }];

function Reports() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle sub="Synthetic figures for the last 30 days.">Reports</PageTitle>
      <div className="grid grid-cols-3 gap-4">
        {[["Average time to acceptance", "1.4 days"], ["Handovers returned", "15"], ["Missing items caught before sending", "42"]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-card p-5"><div className="font-bold text-muted-foreground">{l}</div><div className="mt-1 text-4xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="mt-6 rounded-lg bg-card p-6">
        <h2 className="mb-4 text-xl font-bold">Handovers returned by reason</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={returned}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="reason" /><YAxis allowDecimals={false} />
              <Bar dataKey="n" name="Returned" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
