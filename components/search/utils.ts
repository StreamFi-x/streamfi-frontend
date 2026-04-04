import type {
  SearchCategoryResult,
  SearchStreamResult,
  SearchUserResult,
} from "./types";

export function getUserHref(user: SearchUserResult): string {
  return `/${encodeURIComponent(user.username)}`;
}

export function getStreamHref(stream: SearchStreamResult): string {
  return `/${encodeURIComponent(stream.username)}`;
}

export function getCategoryHref(category: SearchCategoryResult): string {
  return `/browse/category/${encodeURIComponent(category.title)}`;
}

export function getSearchPageHref(query: string, type = "all"): string {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (type !== "all") {
    params.set("type", type);
  }
  const suffix = params.toString();
  return suffix ? `/search?${suffix}` : "/search";
}
