import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRequirements,
  compareVersions,
  type DeviceCapabilities,
  type GameRequirements,
} from "./analyzer.ts";

test("compares version components numerically", () => {
  assert.equal(compareVersions("10.0", "9.0"), "meets");
  assert.equal(compareVersions("10.0", "11.0"), "does-not-meet");
  assert.equal(compareVersions("10.1", "10.0"), "meets");
  assert.equal(compareVersions("10.0", "10"), "meets");
});

test("invalid versions cannot pass", () => {
  assert.equal(compareVersions("unknown", "10.0"), "unknown");
  assert.equal(compareVersions("3.x", "3.2"), "unknown");
});

test("compares RAM and calculates the percent relative to recommended", () => {
  const requirements: GameRequirements = {
    gameName: "Demo",
    recommendedRamGb: 8,
  };
  const device: DeviceCapabilities = {
    osName: "Android",
    osVersion: "14",
    totalRamGb: 6,
    modelName: "Demo phone",
    processorName: "Chipset",
    supportedAbis: ["arm64-v8a"],
  };

  assert.deepEqual(compareRequirements(requirements, device)[0], {
    name: "Memoria RAM",
    recommended: "8.0 GB",
    device: "6.0 GB",
    status: "does-not-meet",
    percentageDifference: -25,
  });
});

test("does not guess processor compatibility from its name", () => {
  const comparisons = compareRequirements(
    { gameName: "Demo", processorRequirement: "Chipset A" },
    {
      osName: "Android",
      osVersion: "14",
      modelName: "Demo phone",
      processorName: "Chipset B",
      supportedAbis: [],
    },
  );

  assert.equal(comparisons[0]?.status, "unknown");
});
