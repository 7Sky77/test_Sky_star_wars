import { describe, expect, it } from "vitest";
import { fleetFlightSeconds, validateMissionTarget } from "./fleet.js";

const world = {
  minArm: 1,
  maxArm: 50,
  minSystem: 1,
  maxSystem: 50,
  starSlot: 0 as const,
  maxPlanetSlot: 9,
};

describe("fleet", () => {
  it("validates target coords", () => {
    expect(validateMissionTarget(7, 12, 3, world)).toBe(true);
    expect(validateMissionTarget(7, 12, 0, world)).toBe(true);
    expect(validateMissionTarget(7, 12, 10, world)).toBe(false);
  });

  it("flight time grows with distance and speed", () => {
    const near = fleetFlightSeconds(
      { arm: 1, system: 1, position: 1 },
      { arm: 1, system: 1, position: 2 },
      100
    );
    const far = fleetFlightSeconds(
      { arm: 1, system: 1, position: 1 },
      { arm: 3, system: 5, position: 8 },
      100
    );
    const slow = fleetFlightSeconds(
      { arm: 1, system: 1, position: 1 },
      { arm: 3, system: 5, position: 8 },
      50
    );
    expect(far).toBeGreaterThan(near);
    expect(slow).toBeGreaterThan(far);
  });
});
