/**
 * @jest-environment node
 */
import { POST } from "../xml-to-json/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/xml-to-json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/xml-to-json", () => {
  it("converts simple XML element", async () => {
    const res = await POST(makeReq({ xml: "<root><name>Alice</name></root>" }));
    expect(res.status).toBe(200);
    const { json, root_element } = await res.json();
    expect(root_element).toBe("root");
    expect(json.root.name["#text"]).toBe("Alice");
  });

  it("handles attributes with default @ prefix", async () => {
    const res = await POST(makeReq({ xml: '<root id="42"><item/></root>' }));
    const { json } = await res.json();
    expect(json.root["@id"]).toBe("42");
  });

  it("respects custom attribute_prefix", async () => {
    const res = await POST(makeReq({ xml: '<root id="1"/>', attribute_prefix: "_" }));
    const { json } = await res.json();
    expect(json.root["_id"]).toBe("1");
  });

  it("respects custom text_key", async () => {
    const res = await POST(makeReq({ xml: "<root>hello</root>", text_key: "$" }));
    const { json } = await res.json();
    expect(json.root["$"]).toBe("hello");
  });

  it("handles nested elements", async () => {
    const xml = "<book><title>Rust</title><author>Steve</author></book>";
    const res = await POST(makeReq({ xml }));
    const { json } = await res.json();
    expect(json.book.title["#text"]).toBe("Rust");
    expect(json.book.author["#text"]).toBe("Steve");
  });

  it("handles CDATA sections", async () => {
    const xml = "<root><![CDATA[<b>raw html</b>]]></root>";
    const res = await POST(makeReq({ xml }));
    const { json } = await res.json();
    expect(json.root["#text"]).toContain("<b>raw html</b>");
  });

  it("returns 400 for malformed XML", async () => {
    const res = await POST(makeReq({ xml: "<root><unclosed>" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for mismatched closing tag", async () => {
    const res = await POST(makeReq({ xml: "<root></other>" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty xml", async () => {
    const res = await POST(makeReq({ xml: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when xml is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });
});
