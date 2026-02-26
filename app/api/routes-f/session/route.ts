import {
  ROUTES_F_ERROR_CODES,
  RoutesFError,
  routesFErrorResponse,
} from "../_lib/errors";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new RoutesFError(
        ROUTES_F_ERROR_CODES.UNAUTHORIZED,
        "Missing authorization header"
      );
    }

    if (authHeader !== "Bearer routes-f-token") {
      throw new RoutesFError(ROUTES_F_ERROR_CODES.FORBIDDEN, "Invalid session token");
    }

    return Response.json({
      ok: true,
      session: "active",
    });
  } catch (error) {
    return routesFErrorResponse(error);
  }
}
