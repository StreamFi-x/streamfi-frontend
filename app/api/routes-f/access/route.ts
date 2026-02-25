import {
  ROUTES_F_ERROR_CODES,
  RoutesFError,
  routesFErrorResponse,
} from "../_lib/errors";

type AccessInput = {
  role?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AccessInput;

    if (typeof body.role !== "string") {
      throw new RoutesFError(
        ROUTES_F_ERROR_CODES.BAD_REQUEST,
        "role is required",
        { field: "role" }
      );
    }

    if (body.role !== "admin" && body.role !== "editor") {
      throw new RoutesFError(
        ROUTES_F_ERROR_CODES.UNPROCESSABLE_ENTITY,
        "role must be admin or editor",
        { allowed: ["admin", "editor"] }
      );
    }

    return Response.json({ ok: true, role: body.role });
  } catch (error) {
    return routesFErrorResponse(error);
  }
}
