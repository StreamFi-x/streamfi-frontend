import { mimeMappings } from "./mime-data";

function normalizeExtension(ext: string) {
  return ext.replace(/^\./, "").toLowerCase();
}

export function lookupByExtension(extension: string) {
  const normalized = normalizeExtension(extension);
  return mimeMappings.find((entry) => entry.extensions.some((ext) => ext.toLowerCase() === normalized));
}

export function lookupByMime(mime: string) {
  const normalized = mime.toLowerCase();
  return mimeMappings.find((entry) => entry.mime.toLowerCase() === normalized);
}

export function suggestForUnknownExtension(extension: string): string[] {
  const normalized = normalizeExtension(extension);
  return mimeMappings
    .flatMap((entry) => entry.extensions)
    .filter((ext) => ext.includes(normalized.slice(0, 2)))
    .slice(0, 5);
}

export function suggestForUnknownMime(mime: string): string[] {
  const normalized = mime.toLowerCase();
  return mimeMappings
    .map((entry) => entry.mime)
    .filter((candidate) => candidate.startsWith(normalized.split("/")[0] ?? ""))
    .slice(0, 5);
}
