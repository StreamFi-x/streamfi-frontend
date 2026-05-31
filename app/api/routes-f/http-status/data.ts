export interface HttpStatus {
  code: number;
  name: string;
  description: string;
  category: string;
  rfc?: string;
}

export const HTTP_STATUSES: HttpStatus[] = [
  { code: 100, name: "Continue", description: "The server has received the request headers and the client should proceed.", category: "1xx", rfc: "RFC 7231" },
  { code: 101, name: "Switching Protocols", description: "The requester has asked the server to switch protocols.", category: "1xx", rfc: "RFC 7231" },
  { code: 200, name: "OK", description: "The request succeeded.", category: "2xx", rfc: "RFC 7231" },
  { code: 201, name: "Created", description: "The request succeeded and a new resource was created.", category: "2xx", rfc: "RFC 7231" },
  { code: 202, name: "Accepted", description: "The request has been received but not yet acted upon.", category: "2xx", rfc: "RFC 7231" },
  { code: 204, name: "No Content", description: "There is no content to send for this request.", category: "2xx", rfc: "RFC 7231" },
  { code: 301, name: "Moved Permanently", description: "The URL of the requested resource has been changed permanently.", category: "3xx", rfc: "RFC 7231" },
  { code: 302, name: "Found", description: "The URI of requested resource has been changed temporarily.", category: "3xx", rfc: "RFC 7231" },
  { code: 304, name: "Not Modified", description: "The response has not been modified.", category: "3xx", rfc: "RFC 7232" },
  { code: 400, name: "Bad Request", description: "The server cannot or will not process the request due to client error.", category: "4xx", rfc: "RFC 7231" },
  { code: 401, name: "Unauthorized", description: "Authentication is required and has failed or not been provided.", category: "4xx", rfc: "RFC 7235" },
  { code: 403, name: "Forbidden", description: "The client does not have access rights to the content.", category: "4xx", rfc: "RFC 7231" },
  { code: 404, name: "Not Found", description: "The server can not find the requested resource.", category: "4xx", rfc: "RFC 7231" },
  { code: 405, name: "Method Not Allowed", description: "The request method is known by the server but is not supported.", category: "4xx", rfc: "RFC 7231" },
  { code: 409, name: "Conflict", description: "The request conflicts with the current state of the server.", category: "4xx", rfc: "RFC 7231" },
  { code: 410, name: "Gone", description: "The content has been permanently deleted from server.", category: "4xx", rfc: "RFC 7231" },
  { code: 413, name: "Payload Too Large", description: "The request entity is larger than limits defined by server.", category: "4xx", rfc: "RFC 7231" },
  { code: 422, name: "Unprocessable Entity", description: "The request was well-formed but could not be followed due to semantic errors.", category: "4xx", rfc: "RFC 4918" },
  { code: 429, name: "Too Many Requests", description: "The user has sent too many requests in a given amount of time.", category: "4xx", rfc: "RFC 6585" },
  { code: 500, name: "Internal Server Error", description: "The server has encountered a situation it does not know how to handle.", category: "5xx", rfc: "RFC 7231" },
  { code: 501, name: "Not Implemented", description: "The request method is not supported by the server.", category: "5xx", rfc: "RFC 7231" },
  { code: 502, name: "Bad Gateway", description: "The server got an invalid response while working as a gateway.", category: "5xx", rfc: "RFC 7231" },
  { code: 503, name: "Service Unavailable", description: "The server is not ready to handle the request.", category: "5xx", rfc: "RFC 7231" },
  { code: 504, name: "Gateway Timeout", description: "The server is acting as a gateway and cannot get a response in time.", category: "5xx", rfc: "RFC 7231" },
];

export function getStatusByCode(code: number): HttpStatus | undefined {
  return HTTP_STATUSES.find((s) => s.code === code);
}

export function getStatusesByCategory(): Record<string, HttpStatus[]> {
  return HTTP_STATUSES.reduce<Record<string, HttpStatus[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
}

export function findNearestStatus(code: number): HttpStatus | undefined {
  return HTTP_STATUSES.reduce<HttpStatus | undefined>((nearest, s) => {
    if (!nearest) return s;
    return Math.abs(s.code - code) < Math.abs(nearest.code - code) ? s : nearest;
  }, undefined);
}
