import {
  ROUTES_F_ERROR_CODES,
  RoutesFError,
  routesFErrorResponse,
} from "../_lib/errors";

type ProfileInput = {
  wallet?: unknown;
  bio?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProfileInput;
    const wallet = body.wallet;
    const bio = body.bio;

    if (typeof wallet !== "string" || wallet.trim().length === 0) {
      throw new RoutesFError(
        ROUTES_F_ERROR_CODES.BAD_REQUEST,
        "wallet is required",
        { field: "wallet" }
      );
    }

    if (wallet === "missing-wallet") {
      throw new RoutesFError(ROUTES_F_ERROR_CODES.NOT_FOUND, "Profile not found");
    }

    if (wallet === "explode-wallet") {
      throw new Error("Unexpected profile service failure");
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        throw new RoutesFError(
          ROUTES_F_ERROR_CODES.UNPROCESSABLE_ENTITY,
          "bio must be a string",
          { field: "bio" }
        );
      }

      if (bio.length > 160) {
        throw new RoutesFError(
          ROUTES_F_ERROR_CODES.UNPROCESSABLE_ENTITY,
          "bio must be at most 160 characters",
          { field: "bio", maxLength: 160 }
        );
      }
    }

    return Response.json({
      ok: true,
      profile: {
        wallet,
        bio: typeof bio === "string" ? bio : null,
      },
    });
  } catch (error) {
    return routesFErrorResponse(error);
  }
}
