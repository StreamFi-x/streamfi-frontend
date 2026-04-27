import { MORSE_MAP, REVERSE_MORSE_MAP } from "./consts";

export function encodeMorse(
    input: string,
    dot: string = ".",
    dash: string = "-"
): string {
    return input
        .toUpperCase()
        .trim()
        .split(/\s+/)
        .map((word) =>
            word
                .split("")
                .map((char) => MORSE_MAP[char] || "")
                .filter(Boolean)
                .join(" ")
        )
        .join(" / ")
        .replace(/\./g, dot)
        .replace(/-/g, dash);
}

export function decodeMorse(
    input: string,
    dot: string = ".",
    dash: string = "-"
): string {
    // Normalize custom characters back to standard . and -
    const normalized = input
        .trim()
        .replace(new RegExp(`\\${dot}`, "g"), ".")
        .replace(new RegExp(`\\${dash}`, "g"), "-");

    return normalized
        .split(" / ")
        .map((word) =>
            word
                .split(" ")
                .map((code) => REVERSE_MORSE_MAP[code] || "?")
                .join("")
        )
        .join(" ");
}
