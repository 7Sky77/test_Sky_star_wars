import { describe, expect, it } from "vitest";
import {
  resourceFromUnires,
  resourcesPerUnire,
  uniresFromCostRecord,
  uniresFromResources,
} from "./unires.js";
import type { UniresDef } from "./schemas.js";

const config: UniresDef = {
  name: "Унирес",
  shortName: "ун.",
  description: "test",
  perThousand: { metal: 4000, minerals: 2000, vespene: 1000 },
};

describe("unires", () => {
  it("converts 1000 unires worth of each resource", () => {
    expect(uniresFromResources({ metal: 4000 }, config)).toBe(1000);
    expect(uniresFromResources({ minerals: 2000 }, config)).toBe(1000);
    expect(uniresFromResources({ vespene: 1000 }, config)).toBe(1000);
  });

  it("sums mixed resources", () => {
    expect(uniresFromResources({ metal: 2000, minerals: 1000, vespene: 500 }, config)).toBe(
      1500
    );
  });

  it("resources per unire", () => {
    expect(resourcesPerUnire(config)).toEqual({ metal: 4, minerals: 2, vespene: 1 });
  });

  it("cost record and reverse conversion", () => {
    expect(uniresFromCostRecord({ metal: 8000, vespene: 2000 }, config)).toBe(4000);
    expect(resourceFromUnires(1000, "metal", config)).toBe(4000);
    expect(resourceFromUnires(1000, "minerals", config)).toBe(2000);
    expect(resourceFromUnires(1000, "vespene", config)).toBe(1000);
  });
});
