export const MOCK_LOCATIONS = [
  {
    country: "United States",
    country_code: "US",
    region: "California",
    city: "San Francisco",
    timezone: "America/Los_Angeles",
    isp: "Mockwest Fiber",
    lat: 37.7749,
    lng: -122.4194,
  },
  {
    country: "Canada",
    country_code: "CA",
    region: "Ontario",
    city: "Toronto",
    timezone: "America/Toronto",
    isp: "Northern Grid",
    lat: 43.6532,
    lng: -79.3832,
  },
  {
    country: "United Kingdom",
    country_code: "GB",
    region: "England",
    city: "London",
    timezone: "Europe/London",
    isp: "BritSat Networks",
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    country: "Australia",
    country_code: "AU",
    region: "New South Wales",
    city: "Sydney",
    timezone: "Australia/Sydney",
    isp: "Down Under Connect",
    lat: -33.8688,
    lng: 151.2093,
  },
  {
    country: "Germany",
    country_code: "DE",
    region: "Bavaria",
    city: "Munich",
    timezone: "Europe/Berlin",
    isp: "EuroLink ISP",
    lat: 48.1351,
    lng: 11.5820,
  },
  {
    country: "Japan",
    country_code: "JP",
    region: "Tokyo",
    city: "Tokyo",
    timezone: "Asia/Tokyo",
    isp: "Sakura Net",
    lat: 35.6895,
    lng: 139.6917,
  },
  {
    country: "Brazil",
    country_code: "BR",
    region: "São Paulo",
    city: "São Paulo",
    timezone: "America/Sao_Paulo",
    isp: "RioWave",
    lat: -23.5505,
    lng: -46.6333,
  },
  {
    country: "South Africa",
    country_code: "ZA",
    region: "Gauteng",
    city: "Johannesburg",
    timezone: "Africa/Johannesburg",
    isp: "PanAfrican Nets",
    lat: -26.2041,
    lng: 28.0473,
  },
];

export function stableHash(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
