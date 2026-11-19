import { ALERT_SPEED_KMH, distanceKm, isImpossibleTravel } from "@/lib/security/login-anomaly";

describe("impossible travel scoring", () => {
  it("uses the documented 900 km/h passive threshold", () => {
    expect(ALERT_SPEED_KMH).toBe(900);
    expect(isImpossibleTravel(900, 60)).toBe(false);
    expect(isImpossibleTravel(1500, 60)).toBe(true);
  });

  it("does not flag same-city/VPN movement or require history under one minute", () => {
    expect(isImpossibleTravel(5, 10)).toBe(false);
    expect(isImpossibleTravel(10_000, 0.5)).toBe(false);
  });

  it("computes long-distance travel across hemispheres", () => {
    expect(distanceKm(40.7128, -74.006, -33.8688, 151.2093)).toBeGreaterThan(15_000);
  });
});