import maxmind, { type CityResponse, type Reader } from "maxmind";
import { isIP } from "node:net";

export type IpLocation = {
  countryCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

let readerPromise: Promise<Reader<CityResponse> | null> | null = null;

async function getReader(): Promise<Reader<CityResponse> | null> {
  const path = process.env.GEOIP_CITY_DB_PATH;
  if (!path) {return null;}
  if (!readerPromise) {
    readerPromise = maxmind.open<CityResponse>(path).catch(error => {
      console.error("[ip-geolocation] Local GeoIP database unavailable", error);
      return null;
    });
  }
  return readerPromise;
}

export async function locateIp(ip: string | null): Promise<IpLocation> {
  const empty = { countryCode: null, city: null, latitude: null, longitude: null };
  if (!ip || !isIP(ip)) {return empty;}
  const reader = await getReader();
  if (!reader) {return empty;}
  const result = reader.get(ip);
  return {
    countryCode: result?.country?.iso_code ?? null,
    city: result?.city?.names?.en ?? null,
    latitude: result?.location?.latitude ?? null,
    longitude: result?.location?.longitude ?? null,
  };
}