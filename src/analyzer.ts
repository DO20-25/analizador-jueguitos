export type RequirementStatus = "meets" | "does-not-meet" | "unknown";

export interface GameRequirements {
  gameName: string;
  minimumOsVersion?: string;
  recommendedRamGb?: number;
  minimumOpenGlesVersion?: string;
  processorRequirement?: string;
  graphicsRequirement?: string;
  sourceUrl?: string;
}

export interface DeviceCapabilities {
  osName: string;
  osVersion: string;
  platformApiLevel?: number | null;
  totalRamGb?: number | null;
  openGlesVersion?: string | null;
  graphicsName?: string | null;
  modelName: string;
  processorName: string;
  supportedAbis: string[];
}

export interface RequirementComparison {
  name: string;
  recommended: string;
  device: string;
  status: RequirementStatus;
  percentageDifference?: number;
}

export function isValidVersionFormat(value: string): boolean {
  const parts = value.trim().split(".");
  return (
    parts.length > 0 &&
    parts.every((part) => part.length > 0 && /^\d+$/.test(part))
  );
}

export function compareVersions(
  actual: string,
  minimum: string,
): RequirementStatus {
  if (!isValidVersionFormat(actual) || !isValidVersionFormat(minimum)) {
    return "unknown";
  }

  const actualParts = actual.trim().split(".").map(Number);
  const minimumParts = minimum.trim().split(".").map(Number);
  const partCount = Math.max(actualParts.length, minimumParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (actualPart !== minimumPart) {
      return actualPart > minimumPart ? "meets" : "does-not-meet";
    }
  }

  return "meets";
}

export function compareRequirements(
  requirements: GameRequirements,
  device: DeviceCapabilities,
): RequirementComparison[] {
  const comparisons: RequirementComparison[] = [];

  if (requirements.minimumOsVersion) {
    comparisons.push({
      name: device.osName,
      recommended: requirements.minimumOsVersion,
      device: device.osVersion,
      status: compareVersions(device.osVersion, requirements.minimumOsVersion),
    });
  }

  if (requirements.recommendedRamGb !== undefined) {
    const actual = device.totalRamGb;
    const percentageDifference =
      actual != null && requirements.recommendedRamGb > 0
        ? ((actual - requirements.recommendedRamGb) /
            requirements.recommendedRamGb) *
          100
        : undefined;

    comparisons.push({
      name: "Memoria RAM",
      recommended: formatRam(requirements.recommendedRamGb),
      device: actual != null ? formatRam(actual) : "No disponible",
      status:
        actual == null
          ? "unknown"
          : actual >= requirements.recommendedRamGb
            ? "meets"
            : "does-not-meet",
      percentageDifference:
        percentageDifference != null && Number.isFinite(percentageDifference)
          ? percentageDifference
          : undefined,
    });
  }

  if (requirements.minimumOpenGlesVersion) {
    const actual = device.openGlesVersion;
    comparisons.push({
      name: "OpenGL ES",
      recommended: requirements.minimumOpenGlesVersion,
      device: actual ?? "No disponible",
      status:
        actual != null
          ? compareVersions(actual, requirements.minimumOpenGlesVersion)
          : "unknown",
    });
  }

  if (requirements.processorRequirement?.trim()) {
    comparisons.push({
      name: "Procesador",
      recommended: requirements.processorRequirement.trim(),
      device: device.processorName,
      status: "unknown",
    });
  }

  if (requirements.graphicsRequirement?.trim()) {
    comparisons.push({
      name: "Gráficos",
      recommended: requirements.graphicsRequirement.trim(),
      device: device.graphicsName ?? "No disponible",
      status: "unknown",
    });
  }

  return comparisons;
}

export function formatRam(gigabytes: number): string {
  return `${gigabytes.toFixed(1)} GB`;
}
