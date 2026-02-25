# Routes-F Meta Endpoint

## Overview

The `/api/routes-f/meta` endpoint provides OpenAPI-like metadata for all routes-f handlers, enabling internal documentation generation.

## Endpoint

```
GET /api/routes-f/meta
```

## Response Format

Returns a simple JSON structure (not full OpenAPI spec):

```json
{
  "routes": [
    {
      "path": "/api/routes-f/health",
      "methods": ["GET"],
      "description": "Health check endpoint",
      "requestSchema": {
        "type": "object",
        "properties": { ... }
      },
      "responseSchema": {
        "type": "object",
        "properties": { ... }
      },
      "deprecated": false
    }
  ]
}
```

## Fields

- **path**: The route path (e.g., `/api/routes-f/health`)
- **methods**: Array of HTTP methods supported (e.g., `["GET", "POST"]`)
- **description**: Human-readable description of the endpoint
- **requestSchema** (optional): Schema reference for request body
- **responseSchema** (optional): Schema reference for response body
- **deprecated** (optional): Boolean flag indicating if the route is deprecated

## Features

### Complete Route Coverage

All routes-f handlers are included:
- `/api/routes-f/health` - Health check
- `/api/routes-f/audit` - Audit trail
- `/api/routes-f/search` - Search records
- `/api/routes-f/validate` - Validate record
- `/api/routes-f/import` - Import records
- `/api/routes-f/export` - Export records
- `/api/routes-f/preferences` - User preferences
- `/api/routes-f/webhook` - Webhook receiver
- `/api/routes-f/flags` - Feature flags
- `/api/routes-f/metrics` - Metrics snapshot
- `/api/routes-f/maintenance` - Maintenance windows
- `/api/routes-f/items/:id` - Item operations
- `/api/routes-f/jobs/:id` - Job status
- `/api/routes-f/meta` - This endpoint

### Deprecation Support

Routes can be marked as deprecated by adding the `deprecated: true` flag:

```typescript
{
  path: "/api/routes-f/old-endpoint",
  methods: ["GET"],
  description: "Legacy endpoint - use /new-endpoint instead",
  deprecated: true
}
```

### Schema References

Request and response schemas provide type information for documentation:

```typescript
requestSchema: {
  type: "object",
  properties: {
    name: { type: "string" },
    method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }
  }
}
```

## Usage Examples

### Fetch Metadata

```bash
curl http://localhost:3000/api/routes-f/meta
```

### Generate Documentation

```typescript
const response = await fetch('/api/routes-f/meta');
const { routes } = await response.json();

routes.forEach(route => {
  console.log(`${route.methods.join(', ')} ${route.path}`);
  console.log(`  ${route.description}`);
  if (route.deprecated) {
    console.log('  ⚠️  DEPRECATED');
  }
});
```

### Filter Deprecated Routes

```typescript
const response = await fetch('/api/routes-f/meta');
const { routes } = await response.json();

const deprecated = routes.filter(r => r.deprecated);
console.log('Deprecated routes:', deprecated.map(r => r.path));
```

## Testing

Tests verify:
- ✅ Returns 200 status
- ✅ Includes all routes-f handlers
- ✅ Each route has methods array
- ✅ Each route has description
- ✅ Schema references are included where applicable
- ✅ Deprecated flag is properly typed

Run tests:

```bash
npm test -- app/api/routes-f/__tests__/meta.test.ts
```

## Implementation Notes

- Simple JSON format (not full OpenAPI 3.0 spec)
- No authentication required
- No rate limiting applied
- Schemas are simplified type references, not full JSON Schema
- Dynamic routes use `:id` notation (e.g., `/items/:id`)
