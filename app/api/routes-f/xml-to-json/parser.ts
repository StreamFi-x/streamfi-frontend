export interface ParseOptions {
  attributePrefix: string;
  textKey: string;
}

type JsonNode = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonNode };
type JsonArray = JsonNode[];

class XmlParser {
  private xml: string;
  private pos: number;
  private opts: ParseOptions;

  constructor(xml: string, opts: ParseOptions) {
    this.xml = xml;
    this.pos = 0;
    this.opts = opts;
  }

  private peek(): string {
    return this.xml[this.pos] ?? "";
  }

  private consume(n = 1) {
    this.pos += n;
  }

  private skipWhitespace() {
    while (this.pos < this.xml.length && /\s/.test(this.xml[this.pos])) {
      this.pos++;
    }
  }

  private error(msg: string): never {
    const before = this.xml.slice(Math.max(0, this.pos - 20), this.pos);
    throw new Error(`${msg} (position ${this.pos}, near: ...${before})`);
  }

  private expect(str: string) {
    if (this.xml.slice(this.pos, this.pos + str.length) !== str) {
      this.error(`Expected '${str}'`);
    }
    this.pos += str.length;
  }

  private readUntil(end: string): string {
    const idx = this.xml.indexOf(end, this.pos);
    if (idx === -1) this.error(`Unterminated sequence, expected '${end}'`);
    const result = this.xml.slice(this.pos, idx);
    this.pos = idx + end.length;
    return result;
  }

  private skipProlog() {
    // Skip XML declaration and processing instructions
    while (this.pos < this.xml.length) {
      this.skipWhitespace();
      if (this.xml.slice(this.pos, this.pos + 2) === "<?") {
        this.readUntil("?>");
      } else if (this.xml.slice(this.pos, this.pos + 4) === "<!--") {
        this.readUntil("-->");
      } else if (this.xml.slice(this.pos, this.pos + 9) === "<!DOCTYPE") {
        this.readUntil(">");
      } else {
        break;
      }
    }
  }

  private readName(): string {
    const start = this.pos;
    while (this.pos < this.xml.length && /[\w\-.:_]/.test(this.xml[this.pos])) {
      this.pos++;
    }
    if (this.pos === start) this.error("Expected XML name");
    return this.xml.slice(start, this.pos);
  }

  private readAttrValue(): string {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") this.error("Expected attribute value quote");
    this.consume();
    const val = this.readUntil(quote);
    return this.unescapeXml(val);
  }

  private unescapeXml(s: string): string {
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  private readElement(): { tag: string; node: JsonObject } {
    this.expect("<");
    const tag = this.readName();
    const attrs: Record<string, string> = {};

    // Read attributes
    while (true) {
      this.skipWhitespace();
      if (this.peek() === "/" || this.peek() === ">") break;
      const attrName = this.readName();
      this.skipWhitespace();
      this.expect("=");
      this.skipWhitespace();
      attrs[attrName] = this.readAttrValue();
    }

    const node: JsonObject = {};
    for (const [k, v] of Object.entries(attrs)) {
      node[this.opts.attributePrefix + k] = v;
    }

    if (this.peek() === "/") {
      // Self-closing
      this.consume();
      this.expect(">");
      return { tag, node };
    }

    this.expect(">");

    // Read children
    const textParts: string[] = [];
    const children: Record<string, JsonNode[]> = {};

    while (true) {
      if (this.xml.slice(this.pos, this.pos + 2) === "</") {
        break;
      }
      if (this.xml.slice(this.pos, this.pos + 4) === "<!--") {
        this.readUntil("-->");
        continue;
      }
      if (this.xml.slice(this.pos, this.pos + 9) === "<![CDATA[") {
        this.pos += 9;
        textParts.push(this.readUntil("]]>"));
        continue;
      }
      if (this.peek() === "<") {
        const child = this.readElement();
        if (!children[child.tag]) children[child.tag] = [];
        children[child.tag].push(child.node);
      } else {
        // Text node
        const start = this.pos;
        while (this.pos < this.xml.length && this.peek() !== "<") this.pos++;
        textParts.push(this.unescapeXml(this.xml.slice(start, this.pos)));
      }
    }

    this.expect("</");
    const closingTag = this.readName();
    if (closingTag !== tag) this.error(`Mismatched tags: <${tag}> closed by </${closingTag}>`);
    this.expect(">");

    const text = textParts.join("").trim();
    if (text) node[this.opts.textKey] = text;

    for (const [childTag, childNodes] of Object.entries(children)) {
      node[childTag] = childNodes.length === 1 ? childNodes[0] : childNodes;
    }

    return { tag, node };
  }

  parse(): { root: string; json: JsonObject } {
    this.skipProlog();
    this.skipWhitespace();
    const { tag, node } = this.readElement();
    return { root: tag, json: { [tag]: node } };
  }
}

export function parseXml(
  xml: string,
  opts: ParseOptions,
): { json: JsonObject; root_element: string } {
  const parser = new XmlParser(xml, opts);
  const { root, json } = parser.parse();
  return { json, root_element: root };
}
