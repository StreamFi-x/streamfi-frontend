import { NextRequest, NextResponse } from "next/server";
import { enqueueExport, getExport, isValidSection } from "./store";
import type {
  CreateExportBody,
  CreateExportResponse,
  ExportSection,
  ExportStatusResponse,
} from "./types";
import { EXPORT_SECTIONS } from "./types";

function validateSections(
  sections: unknown
): { ok: true; sections: ExportSection[] } | { ok: false; error: string } {
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      ok: false,
      error: `sections must be a non-empty array of: ${EXPORT_SECTIONS.join("|")}`,
    };
  }

  const normalized: ExportSection[] = [];
  for (const section of sections) {
    if (!isValidSection(section)) {
      return {
        ok: false,
        error: `invalid section '${String(section)}'; must be one of: ${EXPORT_SECTIONS.join("|")}`,
      };
    }
    if (!normalized.includes(section)) {
      normalized.push(section);
    }
  }

  return { ok: true, sections: normalized };
}

/**
 * POST /api/routes-f/creator-export
 * Body: { creator_id, sections: [streams|tips|followers|subscribers] }
 *
 * Enqueues a CSV export of a creator's analytics data.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, sections } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const sectionResult = validateSections(sections);
  if (!sectionResult.ok) {
    return NextResponse.json({ error: sectionResult.error }, { status: 400 });
  }

  const job = enqueueExport(creator_id, sectionResult.sections);

  return NextResponse.json(
    {
      export_id: job.export_id,
      status: "queued",
    } satisfies CreateExportResponse,
    { status: 202 }
  );
}

/**
 * GET /api/routes-f/creator-export?export_id=exp_1
 *
 * Returns the current status of an export job.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const exportId = req.nextUrl.searchParams.get("export_id");
  if (!exportId) {
    return NextResponse.json(
      { error: "export_id is required" },
      { status: 400 }
    );
  }

  const job = getExport(exportId);
  if (!job) {
    return NextResponse.json(
      { error: `unknown export_id: ${exportId}` },
      { status: 404 }
    );
  }

  const response: ExportStatusResponse = { status: job.status };
  if (job.status === "ready" && job.download_url) {
    response.download_url = job.download_url;
  }
  if (job.status === "failed" && job.error) {
    response.error = job.error;
  }

  return NextResponse.json(response);
}
