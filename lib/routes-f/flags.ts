const FLAG_KEYS = [
  "enableSearch",
  "enableExport",
  "enableMetrics",
  "enableMaintenance",
] as const;

export type RoutesFFlagKey = (typeof FLAG_KEYS)[number];

const ENV_MAP: Record<RoutesFFlagKey, string> = {
  enableSearch: "ROUTES_F_FLAG_SEARCH",
  enableExport: "ROUTES_F_FLAG_EXPORT",
  enableMetrics: "ROUTES_F_FLAG_METRICS",
  enableMaintenance: "ROUTES_F_FLAG_MAINTENANCE",
};

export function getRoutesFFlags(): Record<RoutesFFlagKey, boolean> {
  return FLAG_KEYS.reduce((acc, key) => {
    const envKey = ENV_MAP[key];
    const value = process.env[envKey];
    acc[key] = value === "true";
    return acc;
  }, {} as Record<RoutesFFlagKey, boolean>);
}
