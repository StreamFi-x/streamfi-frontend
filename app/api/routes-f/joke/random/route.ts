import { NextResponse } from "next/server";
import { allJokes, pickRandom, formatJoke } from "../_lib/helpers";

export async function GET() {
  const joke = pickRandom(allJokes);
  if (!joke) {
    return NextResponse.json({ error: "No jokes available." }, { status: 404 });
  }
  return NextResponse.json({ joke: formatJoke(joke) });
}
