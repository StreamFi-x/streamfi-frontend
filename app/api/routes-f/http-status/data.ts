import { HttpStatus } from './types';

export const httpStatuses: HttpStatus[] = [
  // 1xx Informational
  { code: 100, name: 'Continue', description: 'The server has received the request headers and the client should proceed to send the request body', category: '1xx', rfc: 'RFC 7231' },
  { code: 101, name: 'Switching Protocols', description: 'The server is switching protocols according to the Upgrade header field', category: '1xx', rfc: 'RFC 7231' },
  { code: 102, name: 'Processing', description: 'The server has received and is processing the request, but no response is available yet', category: '1xx', rfc: 'RFC 2518' },
  { code: 103, name: 'Early Hints', description: 'The server is likely to send a final response after the request has been fully transmitted', category: '1xx', rfc: 'RFC 8297' },

  // 2xx Success
  { code: 200, name: 'OK', description: 'The request succeeded', category: '2xx', rfc: 'RFC 7231' },
  { code: 201, name: 'Created', description: 'The request succeeded and a new resource was created', category: '2xx', rfc: 'RFC 7231' },
  { code: 202, name: 'Accepted', description: 'The request has been accepted for processing, but the processing has not been completed', category: '2xx', rfc: 'RFC 7231' },
  { code: 203, name: 'Non-Authoritative Information', description: 'The request was successful but the returned meta-information is not from the origin server', category: '2xx', rfc: 'RFC 7231' },
  { code: 204, name: 'No Content', description: 'The server successfully processed the request and is not returning any content', category: '2xx', rfc: 'RFC 7231' },
  { code: 205, name: 'Reset Content', description: 'The server successfully processed the request, but is not returning any content', category: '2xx', rfc: 'RFC 7231' },
  { code: 206, name: 'Partial Content', description: 'The server is delivering only part of the resource due to a range header', category: '2xx', rfc: 'RFC 7233' },
  { code: 207, name: 'Multi-Status', description: 'The message body that follows is an XML message and can contain a number of separate response codes', category: '2xx', rfc: 'RFC 4918' },
  { code: 208, name: 'Already Reported', description: 'The members of a DAV binding have already been enumerated in a preceding reply', category: '2xx', rfc: 'RFC 5842' },
  { code: 226, name: 'IM Used', description: 'The server has fulfilled a GET request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance', category: '2xx', rfc: 'RFC 3229' },

  // 3xx Redirection
  { code: 300, name: 'Multiple Choices', description: 'The request has more than one possible response and the user or user agent must choose one of them', category: '3xx', rfc: 'RFC 7231' },
  { code: 301, name: 'Moved Permanently', description: 'The URL of the requested resource has been changed permanently', category: '3xx', rfc: 'RFC 7231' },
  { code: 302, name: 'Found', description: 'The URL of the requested resource has been changed temporarily', category: '3xx', rfc: 'RFC 7231' },
  { code: 303, name: 'See Other', description: 'The response to the request can be found at another URL using a GET method', category: '3xx', rfc: 'RFC 7231' },
  { code: 304, name: 'Not Modified', description: 'A conditional GET request found that the resource has not been modified', category: '3xx', rfc: 'RFC 7232' },
  { code: 305, name: 'Use Proxy', description: 'The requested resource is only available through a proxy', category: '3xx', rfc: 'RFC 7231' },
  { code: 306, name: 'Switch Proxy', description: 'No longer used, originally meant subsequent requests should use the specified proxy', category: '3xx', rfc: 'RFC 7231' },
  { code: 307, name: 'Temporary Redirect', description: 'The URL of the requested resource has been changed temporarily', category: '3xx', rfc: 'RFC 7231' },
  { code: 308, name: 'Permanent Redirect', description: 'The URL of the requested resource has been changed permanently', category: '3xx', rfc: 'RFC 7538' },

  // 4xx Client Error
  { code: 400, name: 'Bad Request', description: 'The server cannot or will not process the request due to something that is perceived to be a client error', category: '4xx', rfc: 'RFC 7231' },
  { code: 401, name: 'Unauthorized', description: 'The client must authenticate itself to get the requested response', category: '4xx', rfc: 'RFC 7235' },
  { code: 402, name: 'Payment Required', description: 'Reserved for future use', category: '4xx', rfc: 'RFC 7231' },
  { code: 403, name: 'Forbidden', description: 'The client does not have access rights to the content', category: '4xx', rfc: 'RFC 7231' },
  { code: 404, name: 'Not Found', description: 'The server can not find the requested resource', category: '4xx', rfc: 'RFC 7231' },
  { code: 405, name: 'Method Not Allowed', description: 'The request method is known by the server but is not supported by the target resource', category: '4xx', rfc: 'RFC 7231' },
  { code: 406, name: 'Not Acceptable', description: 'The server cannot produce a response matching the list of acceptable values', category: '4xx', rfc: 'RFC 7231' },
  { code: 407, name: 'Proxy Authentication Required', description: 'The client must first authenticate itself with the proxy', category: '4xx', rfc: 'RFC 7231' },
  { code: 408, name: 'Request Timeout', description: 'The server timed out waiting for the request', category: '4xx', rfc: 'RFC 7231' },
  { code: 409, name: 'Conflict', description: 'The request could not be completed due to a conflict with the current state of the resource', category: '4xx', rfc: 'RFC 7231' },
  { code: 410, name: 'Gone', description: 'The resource requested is no longer available and will not be available again', category: '4xx', rfc: 'RFC 7231' },
  { code: 411, name: 'Length Required', description: 'The server rejected the request because the Content-Length header field is not defined', category: '4xx', rfc: 'RFC 7231' },
  { code: 412, name: 'Precondition Failed', description: 'The server does not meet one of the preconditions that the requester puts on the request', category: '4xx', rfc: 'RFC 7232' },
  { code: 413, name: 'Payload Too Large', description: 'The request is larger than the server is willing or able to process', category: '4xx', rfc: 'RFC 7231' },
  { code: 414, name: 'URI Too Long', description: 'The URI provided was too long for the server to process', category: '4xx', rfc: 'RFC 7231' },
  { code: 415, name: 'Unsupported Media Type', description: 'The request entity has a media type which the server or resource does not support', category: '4xx', rfc: 'RFC 7231' },
  { code: 416, name: 'Range Not Satisfiable', description: 'The client has asked for a portion of the file, but the server cannot supply that portion', category: '4xx', rfc: 'RFC 7233' },
  { code: 417, name: 'Expectation Failed', description: 'The server cannot meet the requirements of the Expect request-header field', category: '4xx', rfc: 'RFC 7231' },
  { code: 418, name: "I'm a teapot", description: 'The server refuses the attempt to brew coffee with a teapot', category: '4xx', rfc: 'RFC 2324' },
  { code: 421, name: 'Misdirected Request', description: 'The request was directed at a server that is not able to produce a response', category: '4xx', rfc: 'RFC 7540' },
  { code: 422, name: 'Unprocessable Entity', description: 'The server understands the content type and syntax of the request but was unable to process the contained instructions', category: '4xx', rfc: 'RFC 4918' },
  { code: 423, name: 'Locked', description: 'The resource that is being accessed is locked', category: '4xx', rfc: 'RFC 4918' },
  { code: 424, name: 'Failed Dependency', description: 'The request failed due to failure of a previous request', category: '4xx', rfc: 'RFC 4918' },
  { code: 425, name: 'Too Early', description: 'The server refuses to process the request because the request might be replayed', category: '4xx', rfc: 'RFC 8470' },
  { code: 426, name: 'Upgrade Required', description: 'The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol', category: '4xx', rfc: 'RFC 7231' },
  { code: 428, name: 'Precondition Required', description: 'The origin server requires the request to be conditional', category: '4xx', rfc: 'RFC 6585' },
  { code: 429, name: 'Too Many Requests', description: 'The user has sent too many requests in a given amount of time', category: '4xx', rfc: 'RFC 6585' },
  { code: 431, name: 'Request Header Fields Too Large', description: 'The server is unwilling to process the request because its header fields are too large', category: '4xx', rfc: 'RFC 6585' },
  { code: 451, name: 'Unavailable For Legal Reasons', description: 'The server is denying access to the resource as a consequence of a legal demand', category: '4xx', rfc: 'RFC 7725' },

  // 5xx Server Error
  { code: 500, name: 'Internal Server Error', description: 'The server has encountered a situation it does not know how to handle', category: '5xx', rfc: 'RFC 7231' },
  { code: 501, name: 'Not Implemented', description: 'The server does not support the functionality required to fulfill the request', category: '5xx', rfc: 'RFC 7231' },
  { code: 502, name: 'Bad Gateway', description: 'The server, while working as a gateway, received an invalid response from the upstream server', category: '5xx', rfc: 'RFC 7231' },
  { code: 503, name: 'Service Unavailable', description: 'The server is not ready to handle the request', category: '5xx', rfc: 'RFC 7231' },
  { code: 504, name: 'Gateway Timeout', description: 'The server is acting as a gateway and cannot get a response in time', category: '5xx', rfc: 'RFC 7231' },
  { code: 505, name: 'HTTP Version Not Supported', description: 'The HTTP version used in the request is not supported by the server', category: '5xx', rfc: 'RFC 7231' },
  { code: 506, name: 'Variant Also Negotiates', description: 'Transparent content negotiation for the request results in a circular reference', category: '5xx', rfc: 'RFC 2295' },
  { code: 507, name: 'Insufficient Storage', description: 'The server is unable to store the representation needed to complete the request', category: '5xx', rfc: 'RFC 4918' },
  { code: 508, name: 'Loop Detected', description: 'The server detected an infinite loop while processing the request', category: '5xx', rfc: 'RFC 5842' },
  { code: 510, name: 'Not Extended', description: 'Further extensions to the request are required for the server to fulfill it', category: '5xx', rfc: 'RFC 2774' },
  { code: 511, name: 'Network Authentication Required', description: 'The client needs to authenticate to gain network access', category: '5xx', rfc: 'RFC 6585' },
];

export const getStatusByCode = (code: number): HttpStatus | undefined => {
  return httpStatuses.find(status => status.code === code);
};

export const getStatusesByCategory = () => {
  const grouped: { [category: string]: HttpStatus[] } = {};
  
  httpStatuses.forEach(status => {
    if (!grouped[status.category]) {
      grouped[status.category] = [];
    }
    grouped[status.category].push(status);
  });
  
  return grouped;
};

export const findNearestStatus = (code: number): HttpStatus | null => {
  const sortedCodes = httpStatuses.map(s => s.code).sort((a, b) => a - b);
  
  let nearest = sortedCodes[0];
  let minDiff = Math.abs(code - nearest);
  
  for (const statusCode of sortedCodes) {
    const diff = Math.abs(code - statusCode);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = statusCode;
    }
  }
  
  return getStatusByCode(nearest) || null;
};
