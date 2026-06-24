import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "app/api/routes-f/subscriptions/badges/badge.svg"
    );
    const fileContent = await fs.readFile(filePath, "utf-8");
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "image/svg+xml",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Badge icon not found" }, { status: 404 });
  }
}
