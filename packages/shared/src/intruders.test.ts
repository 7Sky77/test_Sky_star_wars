import { describe, expect, it } from "vitest";
import { intrudersAtCoords, intruderTotalShips } from "./intruders.js";
import type { OrbitIntruderDef } from "./schemas.js";

const sample: OrbitIntruderDef[] = [
  {
    id: "p1",
    name: "Пират",
    intruderKind: "pirate_bot",
    arm: 7,
    system: 12,
    position: 8,
    orbit: "high",
    units: { fighter: 5 },
  },
];

describe("intruders", () => {
  it("finds intruder at coords and orbit", () => {
    expect(intrudersAtCoords(sample, 7, 12, 8, "high")).toHaveLength(1);
    expect(intrudersAtCoords(sample, 7, 12, 8, "low")).toHaveLength(0);
    expect(intruderTotalShips(sample[0].units)).toBe(5);
  });
});
