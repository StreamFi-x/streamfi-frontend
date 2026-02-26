import { NextResponse } from "next/server";
 
export const ROUTES_F_API_VERSION = "1";

export type RoutesFVersionedPayload<T extends object = object> = T & {
  apiVersion: string;
};
 
export function wrapRoutesFJson<T extends object>(data: T): RoutesFVersionedPayload<T> {
  return { ...data, apiVersion: ROUTES_F_API_VERSION } as RoutesFVersionedPayload<T>;
}
 
export function jsonResponse(
  data: object,
  init?: ResponseInit & { status?: number }
): NextResponse {
  return NextResponse.json(wrapRoutesFJson(data), init);
}
