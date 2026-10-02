import { type NextRequest, NextResponse } from "next/server";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type XmlNode = Record<string, unknown>;

/**
 * Minimal XML-to-JSON parser (no external deps).
 * Handles: elements, attributes, text, CDATA.
 */
function parseXml(
  xml: string,
  attrPrefix: string,
  textKey: string
): XmlNode {
  const trimmed = xml.trim();
  if (!trimmed) {throw new Error("XML string is empty.");}

  // Remove XML declaration
  const src = trimmed.replace(/<\?xml[^?]*\?>/i, "").trim();

  let pos = 0;

  function error(msg: string): never {
    throw new Error(msg);
  }

  function skipWhitespace() {
    while (pos < src.length && /\s/.test(src[pos])) {pos++;}
  }

  function readUntil(end: string): string {
    const start = pos;
    const idx = src.indexOf(end, pos);
    if (idx === -1) {error(`Expected '${end}'`);}
    pos = idx + end.length;
    return src.slice(start, idx);
  }

  function parseAttributes(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /(\S+?)=["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      attrs[attrPrefix + m[1]] = m[2];
    }
    return attrs;
  }

  function parseNode(): [string, XmlNode] {
    skipWhitespace();
    if (src[pos] !== "<") {error("Expected '<'");}
    pos++; // consume <

    // CDATA
    if (src.startsWith("![CDATA[", pos)) {
      pos += 8;
      const content = readUntil("]]>");
      return ["#cdata", { [textKey]: content }];
    }

    // Comment
    if (src.startsWith("!--", pos)) {
      readUntil("-->");
      return ["#comment", {}];
    }

    // Closing tag — caller handles
    if (src[pos] === "/") {
      return ["#close", {}];
    }

    // Opening tag
    const tagStart = pos;
    while (pos < src.length && src[pos] !== ">" && src[pos] !== " " && src[pos] !== "\n" && src[pos] !== "\t" && src[pos] !== "/") {
      pos++;
    }
    const tagName = src.slice(tagStart, pos).trim();
    if (!tagName) {error("Empty tag name");}

    // Collect attribute string up to > or />
    const attrStart = pos;
    while (pos < src.length && src[pos] !== ">") {pos++;}
    const attrRaw = src.slice(attrStart, pos).trim();
    const selfClose = attrRaw.endsWith("/");
    const attrStr = selfClose ? attrRaw.slice(0, -1) : attrRaw;
    pos++; // consume >

    const attrs = parseAttributes(attrStr);
    const node: XmlNode = { ...attrs };

    if (selfClose) {return [tagName, node];}

    // Parse children
    let text = "";
    let closed = false;
    while (pos < src.length) {
      skipWhitespace();
      if (pos >= src.length) {break;}

      if (src[pos] !== "<") {
        // Text content
        const txtStart = pos;
        while (pos < src.length && src[pos] !== "<") {pos++;}
        text += src.slice(txtStart, pos).trim();
        continue;
      }

      // Peek at what comes next
      const saved = pos;
      pos++; // consume <

      if (src.startsWith("![CDATA[", pos)) {
        pos += 8;
        const cdata = readUntil("]]>");
        text += cdata;
        continue;
      }

      if (src.startsWith("!--", pos)) {
        readUntil("-->");
        continue;
      }

      if (src[pos] === "/") {
        // Closing tag
        pos++;
        const closeStart = pos;
        while (pos < src.length && src[pos] !== ">") {pos++;}
        const closeName = src.slice(closeStart, pos).trim();
        pos++; // consume >
        if (closeName !== tagName) {error(`Mismatched closing tag: </${closeName}> for <${tagName}>`);}
        closed = true;
        break;
      }

      // Restore and parse child
      pos = saved;
      const [childName, childNode] = parseNode();
      if (childName === "#comment") {continue;}

      if (childName in node) {
        const existing = node[childName];
        node[childName] = Array.isArray(existing)
          ? [...existing, childNode]
          : [existing, childNode];
      } else {
        node[childName] = childNode;
      }
    }

    if (!closed) {error(`Unexpected end of input: unclosed tag <${tagName}>`);}
    if (text) {node[textKey] = text;}

    return [tagName, node];
  }

  const [rootName, rootNode] = parseNode();
  return { [rootName]: rootNode };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { xml, attribute_prefix = "@", text_key = "#text" } = body as Record<string, unknown>;

  if (typeof xml !== "string" || !xml.trim()) {
    return NextResponse.json({ error: "'xml' field is required and must be a non-empty string." }, { status: 400 });
  }

  if (typeof attribute_prefix !== "string") {
    return NextResponse.json({ error: "'attribute_prefix' must be a string." }, { status: 400 });
  }

  if (typeof text_key !== "string") {
    return NextResponse.json({ error: "'text_key' must be a string." }, { status: 400 });
  }

  try {
    const json = parseXml(xml, attribute_prefix, text_key);
    const root_element = Object.keys(json)[0];
    return NextResponse.json({ json, root_element });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse XML.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
