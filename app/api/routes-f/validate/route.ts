import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function POST(req: Request) {
  return withRoutesFLogging(req, async (request) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return routesFError("Invalid JSON payload", 400);
    }

    const result = validateRoutesFRecord(body);

    if (!result.isValid) {
      return routesFSuccess(
        {
          isValid: false,
          errors: result.errors,
          warnings: result.warnings,
        },
        422
      );
    }

    return routesFSuccess(
      {
        isValid: true,
        errors: [],
        warnings: result.warnings,
      },
      200
    );
  });
}