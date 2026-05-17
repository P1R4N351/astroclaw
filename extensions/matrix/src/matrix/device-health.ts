export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleAstroclawDevices: MatrixManagedDeviceInfo[];
  currentAstroclawDevices: MatrixManagedDeviceInfo[];
};

const ASTROCLAW_DEVICE_NAME_PREFIX = "Astroclaw ";

export function isAstroclawManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(ASTROCLAW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const astroClawDevices = devices.filter((device) =>
    isAstroclawManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleAstroclawDevices: astroClawDevices.filter((device) => !device.current),
    currentAstroclawDevices: astroClawDevices.filter((device) => device.current),
  };
}
