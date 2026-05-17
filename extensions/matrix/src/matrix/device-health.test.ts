import { describe, expect, it } from "vitest";
import { isAstroclawManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects Astroclaw-managed device names", () => {
    expect(isAstroclawManagedMatrixDevice("Astroclaw Gateway")).toBe(true);
    expect(isAstroclawManagedMatrixDevice("Astroclaw Debug")).toBe(true);
    expect(isAstroclawManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isAstroclawManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale Astroclaw-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "Astroclaw Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "Astroclaw Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "Astroclaw Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentAstroclawDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "Astroclaw Gateway",
          current: true,
        },
      ],
      staleAstroclawDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "Astroclaw Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "Astroclaw Debug",
          current: false,
        },
      ],
    });
  });
});
