import { describe, expect, it } from "vitest";
import {
  formatGalaxyCoords,
  formatLocalSpaceCoords,
  formatSystemAddress,
  isColonizableSlot,
  isLocalSpaceCenter,
  isValidGalaxyCoords,
  isValidSystemAddress,
  LOCAL_SPACE_CENTER,
  parseGalaxyCoords,
  parseLocalSpaceCoords,
  parseSystemAddress,
  slotLabelRu,
} from "./coords.js";

const world = {
  minArm: 1,
  maxArm: 50,
  minSystem: 1,
  maxSystem: 50,
  starSlot: 0 as const,
  maxPlanetSlot: 9,
};

describe("galaxy coords", () => {
  it("formats system address and galaxy coords", () => {
    expect(formatSystemAddress(7, 12)).toBe("[7:12]");
    expect(formatGalaxyCoords(7, 12, 3)).toBe("[7:12:3]");
    expect(formatGalaxyCoords(3, 850, 0)).toBe("[3:850:0]");
  });

  it("parses coordinate strings", () => {
    expect(parseSystemAddress("[7:12]")).toEqual({ arm: 7, system: 12 });
    expect(parseGalaxyCoords("[7:12:3]")).toEqual({ arm: 7, system: 12, position: 3 });
    expect(parseSystemAddress("[7:12:3]")).toBeNull();
  });

  it("validates ranges", () => {
    expect(isValidSystemAddress(1, 50, world)).toBe(true);
    expect(isValidGalaxyCoords(7, 12, 0, world)).toBe(true);
    expect(isValidGalaxyCoords(7, 12, 10, world)).toBe(false);
  });

  it("labels slots", () => {
    expect(slotLabelRu(0)).toBe("звезда");
    expect(slotLabelRu(4)).toBe("слот 4");
    expect(isColonizableSlot(5, world)).toBe(true);
  });
});

describe("local space coords", () => {
  it("formats and parses XYZ", () => {
    expect(formatLocalSpaceCoords(0, 0, 0)).toBe("0:0:0");
    expect(parseLocalSpaceCoords("12:-3:0")).toEqual({ x: 12, y: -3, z: 0 });
  });

  it("detects center", () => {
    expect(isLocalSpaceCenter(LOCAL_SPACE_CENTER)).toBe(true);
    expect(isLocalSpaceCenter({ x: 1, y: 0, z: 0 })).toBe(false);
  });
});
