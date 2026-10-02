import { NextResponse } from "next/server";

export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body?.text;

    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "text must be a string" },
        { status: 400 }
      );
    }

    return NextResponse.json({ result: removeAccents(text) });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
