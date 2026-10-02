import { NextRequest, NextResponse } from "next/server";
import { enqueueExport, getExport } from "./store";
import type {
  CreateExportBody,
  CreateExportResponse,
  ExportStatusResponse,
} from "./types";

/**
 * POST /api/routes-f/account-data-export
 * Body: { account_id }
 *
 * Queues a full account data export job. Once the job finishes processing,
 * a signed download URL is emailed to the account.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { account_id } = body;

  if (!account_id || typeof account_id !== "string") {
    return NextResponse.json(
      { error: "account_id is required" },
      { status: 400 }
    );
  }

  const job = enqueueExport(account_id);

  return NextResponse.json(
    {
      export_id: job.export_id,
      status: "queued",
    } satisfies CreateExportResponse,
    { status: 202 }
  );
}

/**
 * GET /api/routes-f/account-data-export?export_id=acct_exp_1
 *
 * Returns the current status of an account export job. Once ready, the
 * response includes the download URL and when it was emailed to the account.
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
    response.emailed_at = job.emailed_at;
  }
  if (job.status === "failed" && job.error) {
    response.error = job.error;
  }

  return NextResponse.json(response);
}
