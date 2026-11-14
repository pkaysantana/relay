import { describe, expect, it } from "vitest";
import { rankProviders, tileCounts } from "./logic";
import { HERO_ID, providers, seedPatients, seedTasks } from "./seed";

const hero = seedPatients().find((p) => p.id === HERO_ID)!;

describe("provider ranking", () => {
  it("puts suitable providers first, soonest then nearest", () => {
    const r = rankProviders(hero, providers);
    expect(r.filter((x) => x.suitable).map((x) => x.provider.id)).toEqual(["saturday", "riverside", "staldans"]);
  });
  it("marks one-good-eye and transport mismatches unsuitable", () => {
    const r = rankProviders(hero, providers);
    expect(r.filter((x) => !x.suitable).map((x) => x.provider.id).sort()).toEqual(["brightwater", "clearsight", "meadowbank"]);
    expect(r.find((x) => x.provider.id === "clearsight")!.reason).toBe("Not suitable: does not take patients with only one good eye");
  });
  it("computes weeks saved vs current provider", () => {
    expect(rankProviders(hero, providers)[0]?.weeksSaved).toBe(26);
  });
  it("seeds 3 overdue and 4 due today", () => {
    expect(tileCounts(seedTasks())).toEqual({ overdue: 3, dueToday: 4, doneToday: 0 });
  });
});
