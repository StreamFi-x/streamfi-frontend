import { FONTS, Font } from "./fonts";

const MAX_TEXT_LENGTH = 50;
const SUPPORTED_CHARS_REGEX = /^[A-Za-z0-9 ]+$/;

export function generateAsciiArt(
  text: string,
  fontName: string = "standard",
  width?: number
): string {
  // Validate input
  if (!text || typeof text !== "string") {
    throw new Error("Text is required and must be a string");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text must be ${MAX_TEXT_LENGTH} characters or less`);
  }

  if (!SUPPORTED_CHARS_REGEX.test(text)) {
    throw new Error(
      "Text contains unsupported characters. Only A-Z, a-z, 0-9, and spaces are allowed"
    );
  }

  // Get font
  const font = FONTS[fontName];
  if (!font) {
    throw new Error(
      `Unsupported font: ${fontName}. Available fonts: ${Object.keys(FONTS).join(", ")}`
    );
  }

  // Convert to uppercase for consistency
  const upperText = text.toUpperCase();

  // Generate ASCII art
  const result: string[] = [];

  for (let row = 0; row < font.height; row++) {
    let line = "";

    for (const char of upperText) {
      const charData = font.chars[char];
      if (charData) {
        line += charData[row];
      } else {
        // Use space for unsupported characters
        line += " ".repeat(7);
      }
    }

    // Apply width wrapping if specified
    if (width && width > 0) {
      line = wrapLine(line, width);
    }

    result.push(line);
  }

  return result.join("\n");
}

function wrapLine(line: string, width: number): string {
  if (line.length <= width) {
    return line;
  }

  // Simple wrapping - break at nearest space before width
  let result = "";
  let currentPos = 0;

  while (currentPos < line.length) {
    const chunk = line.substring(
      currentPos,
      Math.min(currentPos + width, line.length)
    );
    result += chunk;

    if (currentPos + width < line.length) {
      result += "\n";
    }

    currentPos += width;
  }

  return result;
}
