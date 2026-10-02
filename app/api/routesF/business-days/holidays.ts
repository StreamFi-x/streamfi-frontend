export type Holiday = {
  date: string;
  name: string;
};

export type HolidayCountry = "US" | "GB" | "JP";

export const HOLIDAYS: Record<HolidayCountry, Holiday[]> = {
  US: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-07-04", name: "Independence Day" },
    { date: "2026-11-26", name: "Thanksgiving Day" },
    { date: "2026-12-24", name: "Christmas Day (observed)" },
    { date: "2026-12-25", name: "Christmas Day" },
  ],
  GB: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-10", name: "Good Friday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day (substitute day)" },
  ],
  JP: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-02-11", name: "National Foundation Day" },
    { date: "2026-05-05", name: "Children's Day" },
    { date: "2026-11-03", name: "Culture Day" },
  ],
};

export const COUNTRY_ALIASES: Record<string, HolidayCountry> = {
  UK: "GB",
};
