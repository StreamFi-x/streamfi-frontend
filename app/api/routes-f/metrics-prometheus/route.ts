import { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const activeStreamsParam = url.searchParams.get("active_streams");
  const activeStreams =
    activeStreamsParam !== null ? parseInt(activeStreamsParam, 10) : 42;

  const prometheusMetrics = `# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05"} 120
http_request_duration_seconds_bucket{le="0.1"} 450
http_request_duration_seconds_bucket{le="0.2"} 890
http_request_duration_seconds_bucket{le="0.5"} 1040
http_request_duration_seconds_bucket{le="1"} 1120
http_request_duration_seconds_bucket{le="+Inf"} 1150
http_request_duration_seconds_sum 142.35
http_request_duration_seconds_count 1150

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{status="200",method="GET"} 1050
http_requests_total{status="400",method="POST"} 35
http_requests_total{status="500",method="GET"} 15
http_requests_total{status="500",method="POST"} 50

# HELP http_error_rate Ratio of 5xx HTTP responses to total requests
# TYPE http_error_rate gauge
http_error_rate 0.0565

# HELP active_streams Total number of currently active streams
# TYPE active_streams gauge
active_streams ${isNaN(activeStreams) ? 42 : activeStreams}
`;

  return new Response(prometheusMetrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
