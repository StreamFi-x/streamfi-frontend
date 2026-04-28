function wordBefore(text: string, pos: number): string {
  let i = pos - 1;
  while (i >= 0 && /[A-Za-z]/.test(text[i])) i--;
  return text.slice(i + 1, pos);
}

export function tokenize(text: string, abbreviations: Set<string>): string[] {
  const sentences: string[] = [];
  let segStart = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === "." || ch === "!" || ch === "?") {
      // Skip ellipsis: ...
      if (ch === "." && text[i + 1] === "." && text[i + 2] === ".") {
        i += 3;
        continue;
      }

      // Consume any closing quotes/brackets right after the punctuation
      let punctEnd = i + 1;
      while (punctEnd < text.length && /["')\]»”’]/.test(text[punctEnd])) {
        punctEnd++;
      }

      // Skip whitespace after punctuation (and optional closing quotes)
      let nextNonSpace = punctEnd;
      while (nextNonSpace < text.length && /\s/.test(text[nextNonSpace])) {
        nextNonSpace++;
      }

      // Only consider as sentence boundary if there was whitespace or end of string
      const hadWhitespace = nextNonSpace > punctEnd;
      const atEnd = nextNonSpace >= text.length;

      if (hadWhitespace || atEnd) {
        const nextCh = atEnd ? "" : text[nextNonSpace];
        const isEnd = atEnd || /[A-Z"'(‘“]/.test(nextCh);

        if (isEnd && ch === ".") {
          // Check for known abbreviation
          const word = wordBefore(text, i);
          if (abbreviations.has((word + ".").toLowerCase())) {
            i++;
            continue;
          }
        }

        if (isEnd) {
          const sentence = text.slice(segStart, punctEnd).trim();
          if (sentence) sentences.push(sentence);
          segStart = nextNonSpace;
          i = nextNonSpace;
          continue;
        }
      }
    }

    i++;
  }

  const remaining = text.slice(segStart).trim();
  if (remaining) sentences.push(remaining);

  return sentences;
}
