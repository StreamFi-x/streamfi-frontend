import { isIP } from "node:net";
import maxmind, { type CityResponse, type Reader } from "maxmind";

let readerPromise: Promise<Reader<CityResponse> | null> | null = null;

async function getReader(): Promise<Reader<CityResponse> | null> {
  const databasePath = process.env.GEOIP_CITY_DB_PATH;
  if (!databasePath) {return null;}
  if (!readerPromise) {
    readerPromise = maxmind.open<CityResponse>(databasePath).catch(error => {
      console.error("[session-geoip] Unable to open local GeoIP database", error);
      return null;
    });
  }
  return readerPromise;
}

export async function lookupIpLocation(ip: string | null): Promise<string> {
  if (!ip || !isIP(ip)) {return "Unknown location";}
  const reader = await getReader();
  if (!reader) {return "Unknown location";}

  const result = reader.get(ip);
  const city = result?.city?.names?.en;
  const country = result?.country?.names?.en;
  if (city && country) {return `${city}, ${country}`;}
  return country ?? "Unknown location";
}