// Common abbreviations that should not trigger sentence splits (stored lowercase with trailing period)
const ABBREVIATIONS: readonly string[] = [
  // Titles
  "mr.", "mrs.", "ms.", "dr.", "prof.", "rev.", "sr.", "jr.", "hon.",
  // Organizations / legal
  "inc.", "corp.", "ltd.", "llc.", "co.", "dept.", "est.", "assn.",
  // Addresses
  "st.", "ave.", "blvd.", "rd.", "ln.", "ct.", "pl.", "sq.", "apt.",
  // Academic / Latin
  "vs.", "etc.", "approx.", "govt.", "univ.", "fig.", "no.",
  "vol.", "pp.", "ed.", "repr.", "trans.", "ibid.", "op.", "loc.",
  // Calendar
  "jan.", "feb.", "mar.", "apr.", "jun.", "jul.", "aug.", "sep.", "oct.", "nov.", "dec.",
  "mon.", "tue.", "wed.", "thu.", "fri.", "sat.", "sun.",
  // Measurements
  "oz.", "lb.", "kg.", "km.", "cm.", "mm.", "ft.", "mi.", "yd.",
  // Misc
  "e.g.", "i.e.", "et.", "al.", "cf.", "viz.",
];

export const abbreviationSet = new Set<string>(ABBREVIATIONS);
